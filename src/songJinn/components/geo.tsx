/* eslint-disable react/jsx-handler-names */
import React, {useState} from 'react';
import {CustomProjection, Graticule} from '@visx/geo';
import {geoMercator} from '@visx/vendor/d3-geo';
import {Zoom} from '@visx/zoom';
import {MapData} from "../constant/map";
import {Text} from "@visx/text";
import {getRegionById} from "../constant/regions";
import {RegionID, SongJinnGame, TerrainType} from "../constant/general";
import {green, orange, red, yellow, purple} from "@material-ui/core/colors";
import {
    centroid,  getJinnTroopByPlace, getSimpleTroopText,
    getSongTroopByPlace,
    getTroopText, placeToStr,
} from "../util";
import {Fab} from "@material-ui/core";


export type GeoCustomProps = {
    G: SongJinnGame,
    moves: Record<string, (...args: any[]) => void>,
    width: number;
    height: number;
    region?: RegionID;
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
    const [detail, setDetail] = useState(false);
    const initialScale = 2000;
    return width < 10 ? null : (
        <>
            <Zoom<SVGSVGElement>
                width={width}
                height={height}
                scaleXMin={1400}
                scaleXMax={7000}
                scaleYMin={1400}
                scaleYMax={7000}

                initialTransformMatrix={{
                    scaleX: initialScale,
                    scaleY: initialScale,
                    translateX: -3850,
                    translateY: 1500,
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
                            <rect x={0} y={0} width={width} height={height} fill={'#fff'} rx={14}/>
                            <CustomProjection<FeatureShape>
                                projection={geoMercator}
                                data={world.features}
                                scale={zoom.transformMatrix.scaleX}
                                translate={[zoom.transformMatrix.translateX, zoom.transformMatrix.translateY]}
                            >
                                {(customProjection) => (
                                    <g>
                                        <Graticule key={`graticule-sj`} graticule={(g) => customProjection.path(g) || ''} stroke={'#fff'}/>
                                        {customProjection.features.map(({feature, path}, i) => {
                                            const projection = geoMercator();

                                            const regionCenter = centroid(feature.geometry.coordinates);
                                            const projected = projection
                                                .scale(zoom.transformMatrix.scaleX)
                                                .translate([zoom.transformMatrix.translateX,
                                                    zoom.transformMatrix.translateY])
                                                (regionCenter);

                                            const region = getRegionById(feature.id - 1);
                                            // if(region.id === chosenRegion){
                                            //     setCenter(regionCenter);
                                            // }
                                            let text = '';
                                            const songTroop = getSongTroopByPlace(G, region.id);
                                            const jinnTroop = getJinnTroopByPlace(G, region.id);
                                            if(detail){
                                                text += songTroop === null ? '' : getTroopText(G, songTroop);
                                                text += '\n';
                                                text += jinnTroop === null ? '' : getTroopText(G, jinnTroop);
                                            }else{
                                                text += songTroop === null ? '' : getSimpleTroopText(G, songTroop);
                                                text += '\n';
                                                text += jinnTroop === null ? '' : getSimpleTroopText(G, jinnTroop);
                                            }
                                            let stroke = '#fff';
                                            if(jinnTroop === null && songTroop !== null){
                                                stroke = '#fff000'
                                            }
                                            if(songTroop === null && jinnTroop !== null){
                                                stroke = red.A400
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
                                                        stroke={stroke}
                                                        fillOpacity={0.4}
                                                        strokeWidth={4}
                                                        strokeOpacity={0.5}
                                                        onClick={() => {
                                                            // if (events) alert(`Clicked: ${feature.properties.name} (${feature.id})`);
                                                        }}
                                                    />
                                                    {projected !== null && <Text
                                                        key={`map-text-${i}`}
                                                        x={projected[0]}
                                                        y={projected[1]}
                                                        fontSize={8}
                                                        textAnchor={'middle'}
                                                        width={8}
                                                    >
                                                        {(region.city !== null ? (region.city + placeToStr(region.id)) : region.name) + text}
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
                            <Fab className="btn btn-lg" onClick={() => {
                                setDetail(!detail)
                            }}>
                                {detail ? "简化" : "详细"}
                            </Fab>
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