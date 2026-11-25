/**
 * The 3D table itself: a printed map sheet on a felt (or plain) table, the live
 * control plates on top of it, the legal-target rings, and the unit counters
 * standing as cardboard standees.
 *
 * The component owns the camera and the pointer; this class owns three.js.  It
 * keeps no game state: `setState` diffs the pieces that changed (controls,
 * targets, selection, units) and rebuilds only those layers, so a seat that
 * rerenders every log line does not re-upload 145 markers.
 *
 * Everything is drawn from game data.  The raster assets are the published map
 * scan, which is exactly the printed board (7706 x 5462, the same coordinate
 * space as `SPACES`), so a marker sits on its printed counterpart, and the
 * module's own counter faces, which a standee wears instead of a lookalike.
 */
import * as THREE from "three";
import background from "../../data/map-background.json";
import {SPACES, SPACE_IDS} from "../../constant/spaces";
import {ImperialElegyState, SpaceId} from "../../types";
import {markerRadius} from "../printedStyle";
import {stackSummary, type StackEntry} from "../stackSummary";
import type {MapTarget, MapTargetStyle} from "../map";
import {
  type TableArt,
  type TableCamera,
  type Vec2,
  type Viewport,
  WORLD_SCALE,
  cameraPosition,
  projectPoint,
  unprojectPoint,
} from "./camera";
import {type TablePalette, readTablePalette} from "./palette";
import {COUNTER_TEXTURE_PX, type CounterFace, counterFace, drawCounterFace, drawUnitFace} from "./counterFace";
import {type UnitFaceArt, loadCounterImage, unitFaceArt} from "./unitArt";
import {pickSpace, pickRadius} from "./hitTest";

export interface TableSceneState {
  G: ImperialElegyState;
  selected: SpaceId | null;
  targets: readonly MapTarget[];
}

export interface TableSceneOptions {
  art: TableArt;
  /** Called when the browser takes the WebGL context away. */
  onContextLost?: () => void;
  /** Called once the published map scan has decoded and is on the sheet. */
  onSheetLoaded?: () => void;
  /** Called when a standee's module counter face has been painted. */
  onFacePainted?: () => void;
}

/** How many counters a space paints before the "+N" badge takes over. */
const VISIBLE_TOKENS = 3;
const SCALE = WORLD_SCALE;
const SHEET = {
  width: (background.viewBox?.[0] ?? 7706) / SCALE,
  height: (background.viewBox?.[1] ?? 5462) / SCALE,
};

/**
 * The sheet's cardboard edge, stacked *below* the printed sheet.
 *
 * The edge used to be a box whose top face sat exactly on the sheet's plane
 * with the same footprint, so the two shared every depth bucket: on some
 * frames the plain top face won the depth test and the whole printed map
 * vanished for that frame — the board flashed blank whenever the camera moved,
 * which is exactly the flicker players reported while dragging.  The edge now
 * stops short of the sheet, and the sheet carries a constant depth offset
 * (`SHEET_DEPTH_OFFSET`) so even a distant camera keeps the map in front.
 */
const SHEET_EDGE_TOP = -0.0022;
/** Above the felt plane (-0.006) so the edge's bottom face never meets it. */
const SHEET_EDGE_BOTTOM = -0.0055;
/** Depth-buffer units the sheet is pulled toward the camera. */
const SHEET_DEPTH_OFFSET = 2;

const RING_STYLE: Record<MapTargetStyle, {width: number; dash: [number, number]; ticks: "pip" | "crosshair" | "rail" | null; double: boolean}> = {
  move: {width: 9, dash: [22, 14], ticks: "pip", double: false},
  attack: {width: 9, dash: [22, 14], ticks: "crosshair", double: false},
  rail: {width: 9, dash: [22, 14], ticks: "rail", double: false},
  choice: {width: 9, dash: [22, 14], ticks: "pip", double: true},
  pending: {width: 7, dash: [12, 12], ticks: null, double: true},
};

const TEXTURE_URLS = {
  large: "/imperial-elegy/maps/world-table.jpg",
  small: "/imperial-elegy/maps/world-table-small.jpg",
};

const starShape = (outer: number): THREE.Shape => {
  const shape = new THREE.Shape();
  const inner = outer * 0.45;
  for (let i = 0; i < 10; i += 1) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
};

const disposeMaterial = (material: THREE.Material | THREE.Material[], keep: Set<THREE.Texture>): void => {
  for (const entry of Array.isArray(material) ? material : [material]) {
    for (const value of Object.values(entry as unknown as Record<string, unknown>)) {
      if (value instanceof THREE.Texture && !keep.has(value)) value.dispose();
    }
    entry.dispose();
  }
};

/**
 * Release a layer's geometry and materials.
 *
 * Counter and ring textures are cached across rebuilds — a unit that moves must
 * not dispose the face it shares with every identical counter — so the caller
 * passes the textures it is keeping.
 */
const disposeTree = (root: THREE.Object3D, keep: Set<THREE.Texture> = new Set()): void => {
  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    if (mesh.material) disposeMaterial(mesh.material, keep);
  });
};

export class TableScene {
  private readonly canvas: HTMLCanvasElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(45, 1, 0.05, 400);
  private readonly tableGroup = new THREE.Group();
  private readonly sheetGroup = new THREE.Group();
  private readonly markerGroup = new THREE.Group();
  private readonly tokenGroup = new THREE.Group();
  private readonly overlayGroup = new THREE.Group();
  private readonly sun: THREE.DirectionalLight;
  private readonly fill: THREE.HemisphereLight;
  private readonly ambient: THREE.AmbientLight;
  private readonly tokenTextures = new Map<string, THREE.CanvasTexture>();
  /** The token keys whose face came from the module rather than the palette. */
  private readonly moduleFaces = new Set<string>();
  private readonly ringTextures = new Map<string, THREE.CanvasTexture>();
  private readonly materialCache = new Map<string, THREE.Material>();
  private readonly tokenGroups: THREE.Group[] = [];
  private readonly rims: THREE.Mesh[] = [];
  private readonly counterPalette: TablePalette["counters"];
  private readonly options: TableSceneOptions;

  private art: TableArt;
  private palette: TablePalette;
  private view: TableCamera;
  private state: TableSceneState | null = null;
  private viewport: Viewport = {width: 1, height: 1};
  private pixelRatio = 1;
  private frame = 0;
  private controlsSignature = "";
  private targetsSignature = "";
  private unitsSignature = "";
  private disposed = false;
  private sheetTexture: THREE.Texture | null = null;

  constructor(canvas: HTMLCanvasElement, options: TableSceneOptions) {
    this.canvas = canvas;
    this.options = options;
    this.art = options.art;
    this.palette = readTablePalette(options.art);
    this.counterPalette = this.palette.counters;
    this.view = {
      yaw: 0,
      pitch: 1.13,
      distance: 13,
      target: {x: (background.paper?.[0] ?? 0) + ((background.paper?.[2] ?? 7706) - (background.paper?.[0] ?? 0)) / 2,
        y: (background.paper?.[1] ?? 0) + ((background.paper?.[3] ?? 5462) - (background.paper?.[1] ?? 0)) / 2},
      fov: 45,
    };
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    // Neutral, not ACES: the printed sheet's paper must stay paper rather than
    // drift sepia under a warm key light.
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    canvas.addEventListener("webglcontextlost", this.handleContextLost);

    this.ambient = new THREE.AmbientLight(0xffffff, 0.28);
    this.fill = new THREE.HemisphereLight(0xffffff, 0x30302c, 0.55);
    this.sun = new THREE.DirectionalLight(0xffffff, 1.35);
    this.sun.position.set(-4, 9, 6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0008;
    const shadowCamera = this.sun.shadow.camera;
    shadowCamera.left = -9;
    shadowCamera.right = 9;
    shadowCamera.top = 9;
    shadowCamera.bottom = -9;
    shadowCamera.near = 0.5;
    shadowCamera.far = 40;
    shadowCamera.updateProjectionMatrix();
    this.scene.add(this.ambient, this.fill, this.sun, this.sun.target);
    this.scene.add(this.tableGroup, this.sheetGroup, this.markerGroup, this.tokenGroup, this.overlayGroup);

    this.buildTable();
    this.loadSheetTexture();
    this.applyArt(this.art);
  }

  // ---------------------------------------------------------------- lifecycle

  private handleContextLost = (event: Event): void => {
    event.preventDefault();
    this.options.onContextLost?.();
  };

  resize(width: number, height: number, pixelRatio: number): void {
    this.viewport = {width: Math.max(1, width), height: Math.max(1, height)};
    this.pixelRatio = Math.min(Math.max(pixelRatio, 1), 2);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(this.viewport.width, this.viewport.height, false);
    this.camera.aspect = this.viewport.width / this.viewport.height;
    this.camera.updateProjectionMatrix();
    this.requestRender();
  }

  setCamera(view: TableCamera): void {
    this.view = view;
    this.requestRender();
  }

  getCamera(): TableCamera {
    return this.view;
  }

  setArt(art: TableArt): void {
    if (art === this.art) return;
    this.art = art;
    this.palette = readTablePalette(art);
    this.applyArt(art);
    // Ring colours belong to the material, so both layers are redrawn.
    this.ringTextures.forEach((texture) => texture.dispose());
    this.ringTextures.clear();
    this.targetsSignature = "";
    this.controlsSignature = "";
    if (this.state) this.setState(this.state);
    this.requestRender();
  }

  setState(state: TableSceneState): void {
    this.state = state;
    this.syncControls(state);
    this.syncTargets(state);
    this.syncSelection(state);
    this.syncTokens(state);
    this.requestRender();
  }

  /** What the table actually drew, for the host's diagnostics and its tests. */
  stats(): {markers: number; tokens: number; faces: number; texture: "pending" | "loaded"} {
    let tokens = 0;
    for (const group of this.tokenGroups) tokens += group.children.length > 0 ? 1 : 0;
    return {
      markers: Math.round(this.markerGroup.children.length / 2),
      tokens,
      faces: this.moduleFaces.size,
      texture: this.sheetTexture === null ? "pending" : "loaded",
    };
  }

  /** Board point -> CSS pixel inside the canvas, or null when off-camera. */
  project(point: Vec2): {x: number; y: number} | null {
    const projected = projectPoint(point, this.view, this.viewport);
    return projected === null ? null : {x: projected.x, y: projected.y};
  }

  /** Canvas-local CSS pixel -> the space it is over. */
  pick(local: Vec2, coarse: boolean): string | null {
    const point = unprojectPoint(local, this.view, this.viewport);
    if (point === null) return null;
    const targets = new Set<string>(this.state?.targets.map((target) => target.id) ?? []);
    return pickSpace(point, pickRadius(this.view, this.viewport, coarse), this.pickables, targets);
  }

  /** Release one layer without touching the textures other layers share. */
  private disposeLayer(root: THREE.Object3D): void {
    disposeTree(root, new Set<THREE.Texture>([...this.tokenTextures.values(), ...this.ringTextures.values()]));
  }

  requestRender(): void {
    if (this.disposed || this.frame !== 0) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.render();
    });
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.frame !== 0) cancelAnimationFrame(this.frame);
    this.canvas.removeEventListener("webglcontextlost", this.handleContextLost);
    disposeTree(this.scene);
    this.tokenTextures.forEach((texture) => texture.dispose());
    this.ringTextures.forEach((texture) => texture.dispose());
    this.sheetTexture?.dispose();
    this.renderer.dispose();
    // A hotseat mounts a board per seat; without this the browser keeps the
    // context and the 17th seat silently loses WebGL.
    this.renderer.forceContextLoss();
  }

  // ---------------------------------------------------------------- build

  private buildTable(): void {
    const margin = 1.4;
    const width = SHEET.width + margin * 2;
    const height = SHEET.height + margin * 2;
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      this.material("table", () => new THREE.MeshStandardMaterial({roughness: 0.96, metalness: 0})),
    );
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(SHEET.width / 2, -0.006, SHEET.height / 2);
    plane.receiveShadow = true;
    plane.name = "table";
    this.tableGroup.add(plane);

    const rimHeight = 0.05;
    const rimWidth = 0.32;
    const rim = (w: number, h: number, x: number, z: number, name: string): THREE.Mesh => {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(w, rimHeight, h),
        this.material(`rim-${name}`, () => new THREE.MeshStandardMaterial({roughness: 0.62, metalness: 0.08})),
      );
      mesh.position.set(x, -0.02, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.rims.push(mesh);
      this.tableGroup.add(mesh);
      return mesh;
    };
    rim(width, rimWidth, SHEET.width / 2, -margin + rimWidth / 2, "north");
    rim(width, rimWidth, SHEET.width / 2, SHEET.height + margin - rimWidth / 2, "south");
    rim(rimWidth, height, -margin + rimWidth / 2, SHEET.height / 2, "west");
    rim(rimWidth, height, SHEET.width + margin - rimWidth / 2, SHEET.height / 2, "east");
  }

  private loadSheetTexture(): void {
    const max = this.renderer.capabilities.maxTextureSize;
    const url = max >= 4096 ? TEXTURE_URLS.large : TEXTURE_URLS.small;
    const edgeHeight = SHEET_EDGE_TOP - SHEET_EDGE_BOTTOM;
    const edge = new THREE.Mesh(
      new THREE.BoxGeometry(SHEET.width, edgeHeight, SHEET.height),
      this.material("sheet-edge", () => new THREE.MeshStandardMaterial({roughness: 0.9})),
    );
    edge.position.set(SHEET.width / 2, SHEET_EDGE_TOP - edgeHeight / 2, SHEET.height / 2);
    edge.receiveShadow = true;
    this.sheetGroup.add(edge);

    const sheetPaper = new THREE.MeshStandardMaterial({roughness: 0.92, metalness: 0});
    // A constant depth offset, not a slope offset: the edge and the sheet are
    // parallel planes, so only the units term separates them at every distance.
    sheetPaper.polygonOffset = true;
    sheetPaper.polygonOffsetFactor = 0;
    sheetPaper.polygonOffsetUnits = -SHEET_DEPTH_OFFSET;
    const sheet = new THREE.Mesh(
      new THREE.PlaneGeometry(SHEET.width, SHEET.height),
      this.material("sheet", () => sheetPaper),
    );
    sheet.rotation.x = -Math.PI / 2;
    sheet.position.set(SHEET.width / 2, 0, SHEET.height / 2);
    sheet.receiveShadow = true;
    sheet.name = "sheet";
    this.sheetGroup.add(sheet);

    new THREE.TextureLoader().load(
      url,
      (texture) => {
        if (this.disposed) {
          texture.dispose();
          return;
        }
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
        this.sheetTexture = texture;
        const material = sheet.material as THREE.MeshStandardMaterial;
        material.map = texture;
        material.needsUpdate = true;
        this.requestRender();
        this.options.onSheetLoaded?.();
      },
      undefined,
      () => {
        // The sheet texture is the only raster asset; without it the table is
        // still playable (plates, rings and counters carry the game state).
      },
    );
  }

  private applyArt(art: TableArt): void {
    const palette = this.palette;
    this.scene.background = new THREE.Color(palette.background);
    const felt = art === "felt";
    this.renderer.shadowMap.enabled = felt;
    this.sun.castShadow = felt;
    // three's physical units divide a light by PI inside the Lambert BRDF, so
    // a sheet lit at ~1.5 units renders at half its printed brightness.  These
    // values put the printed paper back at the scan's own tone.
    this.sun.intensity = felt ? 2 : 1.8;
    this.sun.color = new THREE.Color(felt ? palette.lamp : palette.paper);
    this.ambient.intensity = felt ? 1 : 1.2;
    this.fill.intensity = felt ? 1.1 : 1.2;
    (this.fill as THREE.HemisphereLight).groundColor = new THREE.Color(felt ? palette.woodShade : palette.paper);

    this.tableGroup.visible = true;
    const table = this.tableGroup.getObjectByName("table") as THREE.Mesh | undefined;
    if (table) (table.material as THREE.MeshStandardMaterial).color = new THREE.Color(felt ? palette.felt : palette.background);
    for (const rim of this.rims) {
      (rim.material as THREE.MeshStandardMaterial).color = new THREE.Color(felt ? palette.wood : palette.woodShade);
      rim.visible = felt;
    }
    const edge = this.sheetGroup.children[0] as THREE.Mesh | undefined;
    if (edge) (edge.material as THREE.MeshStandardMaterial).color = new THREE.Color(palette.paper);
    const sheet = this.sheetGroup.children[1] as THREE.Mesh | undefined;
    if (sheet) {
      const material = sheet.material as THREE.MeshStandardMaterial;
      material.color = new THREE.Color(felt ? "#ffffff" : palette.paper);
    }
  }

  /** One material per layer name; recolouring it keeps the geometry reusable. */
  private material<T extends THREE.Material>(key: string, create: () => T): T {
    const cached = this.materialCache.get(key);
    if (cached) return cached as T;
    const created = create();
    this.materialCache.set(key, created);
    return created;
  }

  // ---------------------------------------------------------------- layers

  private get pickables(): {id: string; x: number; y: number}[] {
    return SPACE_IDS.flatMap((id) => {
      const space = SPACES[id];
      return space ? [{id, x: space.x, y: space.y}] : [];
    });
  }

  private syncControls(state: TableSceneState): void {
    const signature = SPACE_IDS.map((id) => state.G.spaces[id]?.control ?? "-").join(",");
    if (signature === this.controlsSignature) return;
    this.controlsSignature = signature;
    this.disposeLayer(this.markerGroup);
    this.markerGroup.clear();
    for (const id of SPACE_IDS) {
      const space = SPACES[id];
      const spaceState = state.G.spaces[id];
      if (!space || !spaceState) continue;
      const radius = markerRadius(space) / SCALE;
      const colours = this.counterPalette.powers[spaceState.control ?? ""] ?? this.counterPalette.neutral;
      const edge = this.plate(space, radius * 1.12, this.counterPalette.ink);
      const face = this.plate(space, radius, colours.fill);
      edge.position.y = 0.0035;
      face.position.y = 0.005;
      this.markerGroup.add(edge, face);
    }
  }

  private plate(space: (typeof SPACES)[string], radius: number, colour: string): THREE.Mesh {
    let geometry: THREE.BufferGeometry;
    if (space.type === "capital" || space.type === "subcapital") {
      geometry = new THREE.ShapeGeometry(starShape(radius), 24);
    } else if (space.type === "navalBox") {
      geometry = new THREE.PlaneGeometry(radius * 2.2, radius * 0.95);
    } else if (space.type === "territory") {
      geometry = new THREE.CircleGeometry(radius, 28);
    } else {
      geometry = new THREE.PlaneGeometry(radius * 1.9, radius * 1.9);
    }
    const material = new THREE.MeshStandardMaterial({color: new THREE.Color(colour), roughness: 0.85, metalness: 0});
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(space.x / SCALE, 0.004, space.y / SCALE);
    return mesh;
  }

  private syncTargets(state: TableSceneState): void {
    const signature = state.targets.map((target) => `${target.id}:${target.style}`).join(",");
    if (signature === this.targetsSignature) return;
    this.targetsSignature = signature;
    this.disposeLayer(this.overlayGroup);
    this.overlayGroup.clear();
    for (const target of state.targets) {
      const space = SPACES[target.id];
      if (!space) continue;
      const radius = (markerRadius(space) / SCALE) * 1.55;
      const texture = this.ringTexture(target.style, false);
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(radius * 2, radius * 2),
        new THREE.MeshBasicMaterial({map: texture, transparent: true, depthWrite: false}),
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(space.x / SCALE, 0.008, space.y / SCALE);
      mesh.renderOrder = 2;
      this.overlayGroup.add(mesh);
    }
  }

  private syncSelection(state: TableSceneState): void {
    const space = state.selected === null ? null : SPACES[state.selected];
    const existing = this.overlayGroup.getObjectByName("selection");
    if (existing) {
      this.disposeLayer(existing);
      this.overlayGroup.remove(existing);
    }
    if (!space) return;
    const radius = (markerRadius(space) / SCALE) * 1.42;
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(radius * 2, radius * 2),
      new THREE.MeshBasicMaterial({map: this.selectionTexture(), transparent: true, depthWrite: false}),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(space.x / SCALE, 0.0075, space.y / SCALE);
    mesh.renderOrder = 3;
    mesh.name = "selection";
    this.overlayGroup.add(mesh);
  }

  private syncTokens(state: TableSceneState): void {
    const units = Object.values(state.G.units ?? {});
    const signature = units.map((unit) => `${unit.id}:${unit.space ?? "-"}:${unit.steps}`).sort().join(",");
    if (signature === this.unitsSignature) return;
    this.unitsSignature = signature;
    this.disposeLayer(this.tokenGroup);
    this.tokenGroup.clear();
    this.tokenGroups.length = 0;
    for (const id of SPACE_IDS) {
      const space = SPACES[id];
      if (!space) continue;
      const stack = stackSummary(units, id);
      if (stack.length === 0) continue;
      const radius = markerRadius(space) / SCALE;
      const size = radius * 1.7;
      const naval = space.type === "navalBox";
      const origin = naval
        ? {x: -radius * 0.55, z: 0}
        : {x: -radius * 0.72, z: radius * 0.72};
      stack.slice(0, VISIBLE_TOKENS).forEach((entry, slot) => {
        const group = this.standee(entry, size);
        if (group === null) return;
        group.position.set(
          space.x / SCALE + origin.x - slot * size * 0.85,
          0,
          space.y / SCALE + origin.z + slot * size * 0.85,
        );
        group.userData.jitter = ((slot * 37 + id.length * 11) % 9) * 0.014 - 0.056;
        this.tokenGroup.add(group);
        this.tokenGroups.push(group);
      });
    }
  }

  private standee(entry: StackEntry, size: number): THREE.Group | null {
    const face = counterFace(entry.power, entry.kind, entry.reduced, this.counterPalette);
    const art = unitFaceArt(entry.power, entry.kind, entry.reduced);
    const key = `${entry.power}|${entry.kind}|${entry.reduced ? "r" : "f"}`;
    const texture = this.tokenTexture(key, face, art);
    // The printed counters are not square: a squadron stands 200 x 120.
    const width = size;
    const height = size / (art?.aspect ?? 1);
    const group = new THREE.Group();
    const paper = new THREE.MeshStandardMaterial({color: new THREE.Color(this.counterPalette.paper), roughness: 0.95});
    const faceMaterial = new THREE.MeshStandardMaterial({
      map: texture,
      transparent: true,
      alphaTest: 0.35,
      roughness: 0.8,
      metalness: 0,
      side: THREE.FrontSide,
    });
    const body = new THREE.Mesh(new THREE.BoxGeometry(width, height, size * 0.045), paper);
    body.position.set(0, height / 2, -size * 0.0225);
    body.castShadow = true;
    const front = new THREE.Mesh(new THREE.PlaneGeometry(width, height), faceMaterial);
    front.position.set(0, height / 2, 0.0004);
    front.castShadow = true;
    const back = new THREE.Mesh(new THREE.PlaneGeometry(width, height), paper);
    back.position.set(0, height / 2, -size * 0.0451);
    back.rotation.y = Math.PI;
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(size * 0.26, size * 0.3, size * 0.03, 16),
      new THREE.MeshStandardMaterial({color: new THREE.Color(this.counterPalette.ink), roughness: 0.9}),
    );
    base.position.y = size * 0.015;
    base.castShadow = true;
    group.add(body, front, back, base);
    return group;
  }

  private tokenTexture(key: string, face: CounterFace, art: UnitFaceArt | null): THREE.CanvasTexture {
    const cached = this.tokenTextures.get(key);
    if (cached) return cached;
    const canvas = document.createElement("canvas");
    canvas.width = COUNTER_TEXTURE_PX;
    canvas.height = COUNTER_TEXTURE_PX;
    const context = canvas.getContext("2d");
    if (context === null) throw new Error("2D canvas unavailable for the counter face");
    drawCounterFace(context, COUNTER_TEXTURE_PX, face);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());
    this.tokenTextures.set(key, texture);
    if (art !== null) this.paintUnitFace(key, context, texture, art);
    return texture;
  }

  /**
   * Replace the drawn stand-in with the module's own counter face once it
   * decodes.  The standee is already on the table, so a slow network shows the
   * paper-and-ink fallback rather than an empty counter, and a face that fails
   * to decode simply keeps it.
   */
  private paintUnitFace(
    key: string,
    context: CanvasRenderingContext2D,
    texture: THREE.CanvasTexture,
    art: UnitFaceArt,
  ): void {
    const urls = art.badge === undefined ? [art.url] : [art.url, art.badge];
    void Promise.all(urls.map(loadCounterImage)).then((images) => {
      if (this.disposed) return;
      const face = images[0] ?? null;
      if (face === null) return;
      drawUnitFace(context, COUNTER_TEXTURE_PX, face, images[1] ?? null);
      texture.needsUpdate = true;
      this.moduleFaces.add(key);
      this.options.onFacePainted?.();
      this.requestRender();
    });
  }

  private ringTexture(style: MapTargetStyle, focus: boolean): THREE.CanvasTexture {
    const key = `${this.art}|${style}|${focus ? "focus" : "plain"}`;
    const cached = this.ringTextures.get(key);
    if (cached) return cached;
    const size = 256;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    if (context === null) throw new Error("2D canvas unavailable for a target ring");
    const spec = RING_STYLE[style];
    const centre = size / 2;
    const radius = size * 0.4;
    context.clearRect(0, 0, size, size);
    context.strokeStyle = this.palette.rings[style];
    context.lineWidth = spec.width;
    context.setLineDash(spec.dash);
    context.beginPath();
    context.arc(centre, centre, radius, 0, Math.PI * 2);
    context.stroke();
    // The printed key's tick vocabulary: a pip for a move, crosshairs for an
    // attack, a heavy rail tick, a double ring for a choice.
    context.setLineDash([]);
    if (spec.ticks === "pip") {
      context.fillStyle = this.palette.rings[style];
      context.beginPath();
      context.arc(centre + radius, centre, spec.width * 1.6, 0, Math.PI * 2);
      context.fill();
    }
    if (spec.ticks === "crosshair" || spec.ticks === "rail") {
      const length = spec.ticks === "rail" ? spec.width * 3 : spec.width * 4;
      context.lineWidth = spec.ticks === "rail" ? spec.width * 1.7 : spec.width;
      for (const angle of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
        context.beginPath();
        context.moveTo(centre + Math.cos(angle) * radius, centre + Math.sin(angle) * radius);
        context.lineTo(centre + Math.cos(angle) * (radius + length), centre + Math.sin(angle) * (radius + length));
        context.stroke();
      }
    }
    if (spec.double) {
      context.lineWidth = spec.width * 0.6;
      context.beginPath();
      context.arc(centre, centre, radius + spec.width * 2.2, 0, Math.PI * 2);
      context.stroke();
    }
    if (focus) {
      context.lineWidth = spec.width * 0.8;
      context.strokeStyle = this.palette.focus;
      context.beginPath();
      context.arc(centre, centre, radius + spec.width * 5, 0, Math.PI * 2);
      context.stroke();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());
    this.ringTextures.set(key, texture);
    return texture;
  }

  private selectionTexture(): THREE.CanvasTexture {
    const cached = this.ringTextures.get(`${this.art}|selection`);
    if (cached) return cached;
    const size = 256;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    if (context === null) throw new Error("2D canvas unavailable for the selection ring");
    const centre = size / 2;
    context.clearRect(0, 0, size, size);
    context.strokeStyle = this.palette.selection;
    context.lineWidth = 10;
    context.shadowColor = this.palette.selection;
    context.shadowBlur = 18;
    context.beginPath();
    context.arc(centre, centre, size * 0.4, 0, Math.PI * 2);
    context.stroke();
    context.shadowBlur = 0;
    context.strokeStyle = this.palette.selection;
    context.lineWidth = 3;
    context.beginPath();
    context.arc(centre, centre, size * 0.44, 0, Math.PI * 2);
    context.stroke();
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    this.ringTextures.set(`${this.art}|selection`, texture);
    return texture;
  }

  // ---------------------------------------------------------------- render

  private render(): void {
    if (this.disposed) return;
    const eye = cameraPosition(this.view);
    this.camera.position.set(eye.x, eye.y, eye.z);
    this.camera.fov = this.view.fov;
    this.camera.aspect = this.viewport.width / this.viewport.height;
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(this.view.target.x / SCALE, 0, this.view.target.y / SCALE);
    this.sun.target.position.set(this.view.target.x / SCALE, 0, this.view.target.y / SCALE);
    for (const group of this.tokenGroups) {
      group.rotation.y = this.view.yaw + (group.userData.jitter as number ?? 0);
    }
    this.renderer.render(this.scene, this.camera);
  }
}
