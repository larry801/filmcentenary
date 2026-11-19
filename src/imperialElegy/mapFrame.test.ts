/**
 * The framing bar in the map's top-left corner (the chips and the theatre
 * list) reaches the map as a `frame` request.  The map is memoized, so its
 * comparison has to treat a new request as a change; when it did not, the
 * controls were clickable but the view never moved.
 */
import {IEMapProps, MapFrameRequest} from "./components/map";
import {mapPropsEqual} from "./components/map";

// Stable identities: the comparison is referential for callbacks and state.
const G = {spaces: {}} as unknown as IEMapProps["G"];
const onSelect = () => undefined;

const props = (overrides: Partial<IEMapProps> = {}): IEMapProps => ({
  G,
  selected: null,
  onSelect,
  locale: "en",
  ...overrides,
});

const request = (overrides: Partial<MapFrameRequest> = {}): MapFrameRequest => ({
  kind: "theatre",
  theatre: "westEurope",
  nonce: 1,
  ...overrides,
});

describe("the map's memo comparison", () => {
  test("a framing request re-renders the map", () => {
    expect(mapPropsEqual(props(), props({frame: request()}))).toBe(false);
  });

  test("pressing the same framing control again re-applies it", () => {
    const first = props({frame: request()});
    // The control bumps the nonce, so the player can re-centre after panning.
    const again = props({frame: request({nonce: 2})});
    expect(mapPropsEqual(first, again)).toBe(false);
  });

  test("an unchanged frame still skips the render", () => {
    const frame = request();
    expect(mapPropsEqual(props({frame}), props({frame}))).toBe(true);
  });

  test("a new seat's capital re-frames the map", () => {
    expect(mapPropsEqual(props({homeCapital: "berlin"}), props({homeCapital: "london"}))).toBe(false);
  });

  test("the drawn state is still compared", () => {
    expect(mapPropsEqual(props(), props({selected: "berlin"}))).toBe(false);
  });
});
