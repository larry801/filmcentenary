/* eslint-disable react/jsx-handler-names */
import React from 'react';
import {CustomProjection, Graticule} from '@visx/geo';
import {geoMercator} from '@visx/vendor/d3-geo';
import {Zoom} from '@visx/zoom';
import {MapData} from "../constant/map";
import {Text} from "@visx/text";
import {getRegionById} from "../constant/regions";
import {SongJinnGame, TerrainType} from "../constant/general";
import {green, orange, red, yellow, purple} from "@material-ui/core/colors";
import {
    centroid,
    getJinnTroopByRegion,
    getSongTroopByPlace,
    getTroopPlaceText,
    getTroopText
} from "../util";


export type GeoCustomProps = {
    G: SongJinnGame,
    moves: Record<string, (...args: any[]) => void>,
    width: number;
    height: number;
    events?: boolean;
};

interface FeatureShape {
    type: 'Feature';
    id: number;
    geometry: { coordinates: [number, number][][]; type: 'Polygon' };
    properties: { name: string };
}

export const background = '#252b7e';


const world = MapData as {
    type: 'FeatureCollection';
    features: FeatureShape[];
};

export function GeoMap({width, height, G}: GeoCustomProps) {
    const initialScale = 2750;
    return width < 10 ? null : (
        <>
            <Zoom<SVGSVGElement>
                width={width}
                height={height}
                scaleXMin={100}
                scaleXMax={5000}
                scaleYMin={100}
                scaleYMax={5000}
                initialTransformMatrix={{
                    scaleX: initialScale,
                    scaleY: initialScale,
                    translateX: -4900,
                    translateY: 1940,
                    skewX: 0,
                    skewY: 0,
                }}
            >
                {(zoom) => (
                    <div className="container">
                        <svg
                            width={width}
                            height={height}
                            className={zoom.isDragging ? 'dragging' : undefined}
                            ref={zoom.containerRef}
                            style={{touchAction: 'none'}}
                        >
                            <rect x={0} y={0} width={width} height={height} fill={background} rx={14}/>
                            <CustomProjection<FeatureShape>
                                projection={geoMercator}
                                data={world.features}
                                scale={zoom.transformMatrix.scaleX}
                                translate={[zoom.transformMatrix.translateX, zoom.transformMatrix.translateY]}
                            >
                                {(customProjection) => (
                                    <g>
                                        <Graticule graticule={(g) => customProjection.path(g) || ''} stroke={'#fff'}/>
                                        {customProjection.features.map(({feature, path}, i) => {
                                            const projection = geoMercator();

                                            const projected = projection
                                                .scale(zoom.transformMatrix.scaleX)
                                                .translate([zoom.transformMatrix.translateX,
                                                    zoom.transformMatrix.translateY])
                                                (centroid(feature.geometry.coordinates));

                                            const region = getRegionById(feature.id - 1);
                                            let text = region.name;
                                            const songTroop = getSongTroopByPlace(G, region.id);
                                            const jinnTroop = getJinnTroopByPlace(G, region.id);
                                            if (songTroop !== null) {
                                                if (jinnTroop !== null) {
                                                    text = getTroopPlaceText(songTroop);
                                                    text += '\n';
                                                    text += getTroopText(G, songTroop);
                                                    text += '\n';
                                                    text += getTroopText(G, jinnTroop);
                                                } else {
                                                    text = getTroopPlaceText(songTroop);
                                                    text += '\n';
                                                    text += getTroopText(G, songTroop);
                                                }
                                            }else{
                                                if (jinnTroop !== null) {
                                                    text += getTroopText(G, jinnTroop);
                                                }
                                            }
                                            let color = '#fff000';
                                            switch (region.terrain) {
                                                case TerrainType.FLATLAND:
                                                    color = green.A700;
                                                    break;
                                                case TerrainType.HILLS:
                                                    color = yellow.A700;
                                                    break;
                                                case TerrainType.MOUNTAINS:
                                                    color = orange.A700
                                                    break;
                                                case TerrainType.SWAMP:
                                                    color = purple.A700
                                                    break;
                                                case TerrainType.RAMPART:
                                                    color = red.A100
                                                    break;
                                            }
                                            return (
                                                <>
                                                    <path
                                                        key={`map-feature-${i}`}
                                                        d={path || ''}
                                                        fill={color}
                                                        stroke={background}
                                                        strokeWidth={0.5}
                                                        onClick={() => {
                                                            // if (events) alert(`Clicked: ${feature.properties.name} (${feature.id})`);
                                                        }}
                                                    />
                                                    {projected !== null && <Text
                                                        key={`map-text-${i}`}
                                                        x={projected[0]}
                                                        y={projected[1]}
                                                        fontSize={12}
                                                        textAnchor={'middle'}
                                                        width={10}
                                                    >
                                                        {text}
                                                    </Text>}

                                                </>
                                            )
                                        })}
                                    </g>
                                )}
                            </CustomProjection>

                            {/** intercept all mouse events */}
                            <rect
                                x={0}
                                y={0}
                                width={width}
                                height={height}
                                rx={14}
                                fill="transparent"
                                onTouchStart={zoom.dragStart}
                                onTouchMove={zoom.dragMove}
                                onTouchEnd={zoom.dragEnd}
                                onMouseDown={zoom.dragStart}
                                onMouseMove={zoom.dragMove}
                                onMouseUp={zoom.dragEnd}
                                onMouseLeave={() => {
                                    if (zoom.isDragging) zoom.dragEnd();
                                }}
                            />
                        </svg>
                        <div className="controls">
                            <button
                                className="btn btn-zoom"
                                onClick={() => {
                                    zoom.scale({scaleX: 1.2, scaleY: 1.2});
                                    console.log(JSON.stringify(zoom.transformMatrix))

                                }}

                            >
                                +
                            </button>
                            <button
                                className="btn btn-zoom btn-bottom"
                                onClick={() => zoom.scale({scaleX: 0.8, scaleY: 0.8})}
                            >
                                -
                            </button>
                            <button className="btn btn-lg" onClick={zoom.reset}>
                                Reset
                            </button>
                        </div>
                    </div>
                )}
            </Zoom>
            <style>{`
        .container {
          position: relative;
        }
        svg {
          cursor: grab;
        }
        svg.dragging {
          cursor: grabbing;
        }
        .btn {
          margin: 0;
          text-align: center;
          border: none;
          background: #dde1fe;
          color: #222;
          padding: 0 4px;
          border-top: 1px solid #8993f9;
        }
        .btn-lg {
          font-size: 12px;
          line-height: 1;
          padding: 4px;
        }
        .btn-zoom {
          width: 26px;
          font-size: 22px;
        }
        .btn-bottom {
          margin-bottom: 1rem;
        }
        .controls {
          position: absolute;
          bottom: 20px;
          right: 15px;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
        }
        label {
          font-size: 12px;
        }
      `}</style>
        </>
    );
}