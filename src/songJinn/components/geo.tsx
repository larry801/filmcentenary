import React from "react";
import { TerrainType} from "../constant/general";
import {Mercator, Graticule} from '@visx/geo';
import {ParentSize} from '@visx/responsive';
import {MapData} from "../constant/map";
import {green, yellow, purple, orange, red} from "@material-ui/core/colors";
import {getRegionById} from "../constant/regions";
import Grid from "@material-ui/core/Grid";
import {Text} from "@visx/text";


export const background = '#f9f7e8';


interface FeatureShape {
    type: 'Feature';
    id: number;
    geometry: { coordinates: [number, number][][]; type: 'Polygon' };
    properties: { name: string };
}


const world = MapData as {
    type: 'FeatureCollection';
    features: FeatureShape[];
};

export const GeoMap = () => {


    return <ParentSize>
        {(parent) => {
            const width = parent.width;
            const height = parent.height;
            const centerX = width / 2;
            const centerY = height / 2;
            const initialScale = (width / 630) * 100;
            console.log(width,height,centerX,centerY, initialScale);

            return <Grid>
                <svg width={width} height={height}>
                    <rect x={0} y={0} width={width} height={height} fill={background} rx={14}/>

                    <Mercator<FeatureShape>
                        key={`mercator-container-0`}
                        data={world.features}
                        scale={initialScale}
                        translate={[centerX, centerY + 50]}
                    >
                        {(mercator) => (
                            <g key={`mercator-0`}>
                                <Graticule key={`graticule-0`}
                                           graticule={(g) => mercator.path(g) || ''}
                                           stroke="rgba(33,33,33,0.05)"/>
                                {mercator.features.map(
                                    ({feature, path}, i) => {
                                        const region = getRegionById(feature.id - 1);
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
                                                        alert(feature.properties.name)
                                                    }}
                                                />
                                                <Text
                                                    key={`text-{i}`}
                                                >
                                                    {region.name}
                                                </Text>
                                            </>
                                        )
                                    })}

                            </g>
                        )}
                    </Mercator>
                </svg>
            </Grid>
        }}
    </ParentSize>

}
