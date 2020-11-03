import React from "react";
import SvgIcon from "@material-ui/core/SvgIcon";
import {Champion, IEra, Region,} from "../types/core";
import {blue, grey, purple, red, yellow} from "@material-ui/core/colors";
import LooksOneIcon from '@material-ui/icons/LooksOne';
import LooksTwoIcon from '@material-ui/icons/LooksTwo';
import Looks3Icon from '@material-ui/icons/Looks3';
import {Badge} from "@material-ui/core";
import ArrowUpwardIcon from '@material-ui/icons/ArrowUpward';

const verticalAlign = {verticalAlign: "-0.125em"};

export interface IShareIconProps {
    r: Region
}

export const LoseShareIcon = ({r}: IShareIconProps) =><Badge
    anchorOrigin={{
        vertical: 'top',
        horizontal: 'left',
    }}
    badgeContent={'-'}
    color="secondary"
>
    <DrawnShareIcon r={r}/>
</Badge>

export const DevelopmentAwardBadge = () => <SvgIcon style={verticalAlign}>
    <g>
        <path style={{fill:"#030104"}} d="M15.554,8.058c0,2.132-1.731,3.861-3.868,3.861c-2.132,0-3.857-1.729-3.857-3.861
			s1.726-3.865,3.857-3.865C13.823,4.192,15.554,5.926,15.554,8.058z"/>
        <path style={{fill:"#030104"}} d="M16.295,12.944l2.516-0.479l-0.608-2.259l1.911-1.508L18.42,6.891l0.917-2.461l-2.566-0.696
			L16.295,1.13L13.73,2.105L11.863,0l-1.74,1.955L7.477,0.92L6.911,3.507L4.305,4.212l0.827,2.233l-1.87,1.807l1.87,1.608
			l-0.65,2.324l2.43,0.583l0.23,0.943L4.22,21.921l3.215-0.833l2.432,2.288l1.82-6.589l2.002,6.589l2.169-2.086l3.559,0.148
			l-3.303-7.767L16.295,12.944z M6.871,8.058c0-2.662,2.16-4.821,4.815-4.821c2.665,0,4.822,2.16,4.822,4.821
			s-2.157,4.818-4.822,4.818C9.032,12.876,6.871,10.719,6.871,8.058z M9.534,21.726l-1.858-1.924l-2.12,0.743l1.923-5.189
			l1.196-0.554l0.944-0.381l1.49,1.534L9.534,21.726z M15.702,20.369l-1.621,1.533l-1.793-6.034l1.224-1.27l2.405,0.757l2.361,5.278
			L15.702,20.369z"/>
    </g>
</SvgIcon>

export const DrawnShareIcon = ({r}: IShareIconProps) => <SvgIcon style={verticalAlign}>
    <path d="
			 M2,8 12,4 22,8 12,12 Z
			 M2,8 2,18 12,22 12,12 Z
			 M12,22 22,18 22,8 12,12Z
    "
          style={{
              stroke: "#ffffff",
              fill: getColor(r),
              strokeWidth: 1,
          }}
    />
</SvgIcon>

export interface IChampionProps {
    champion: Champion,
}

export const ChampionIcon = ({champion}: IChampionProps) => {
    const IconComponent = () => {
        switch (champion.era) {
            case IEra.ONE:
                return LooksOneIcon;
            case IEra.TWO:
                return LooksTwoIcon;
            case IEra.THREE:
                return Looks3Icon;
        }
    }
    const IC = IconComponent();
    return <IC style={{color: getColor(champion.region)}}/>
}

export const ActionPointIcon = () => <SvgIcon style={verticalAlign}>
    <path d="
             M6 6
             A6,3 0 0,0 18,6
             A6,3 0 0,0 6,6
             L6, 18
             A6,3,0 0,0 18,18
             L18, 6
             "
          style={{
              stroke: "#000000",
              fill: "#ffffff",
              strokeWidth: 2,
          }}/>
</SvgIcon>

export const RectOfCard = () => <rect
    style={{
        stroke: "#000000",
        fill: "#ffffff",
        strokeWidth: 1,
    }}
    x="2"
    y="2" width="16"
    height="20" rx="2" ry="2"
    transform="rotate(10,10,10)"
/>

export const CardIcon = () => <SvgIcon style={verticalAlign}>
    {RectOfCard()}
</SvgIcon>

export const CardToArchiveIcon = () => <SvgIcon>
    {RectOfCard()}
    <text
        x="2"
        y="20.5"
        fill="black"
        transform="rotate(10,10,10)"
    >X
    </text>
</SvgIcon>

export const FreeBreakthroughIcon = () => <Badge
    anchorOrigin={{
        vertical: 'top',
        horizontal: 'left',
    }}
    badgeContent={<ArrowUpwardIcon/>}
>
    <CardToArchiveIcon/>
</Badge>

export const DiscardIcon = () => <Badge
    anchorOrigin={{
        vertical: 'top',
        horizontal: 'left',
    }}
    color="secondary"
    variant={"dot"}
>
    <CardIcon/>
</Badge>

export const getColor = (r: Region): string => {
    switch (r) {
        case Region.WE:
            return purple[500]
        case Region.NA:
            return blue[800]
        case Region.EE:
            return red[500]
        case Region.ASIA:
            return yellow[700]
        case Region.NONE:
            return grey[700]
    }
}
