import React from "react";
import SvgIcon from "@material-ui/core/SvgIcon";
import NoScoringCardIcon from '@material-ui/icons/Block';
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
            default:
                return NoScoringCardIcon;
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
export const BuyCardForFreeIcon = () => <SvgIcon style={verticalAlign}>
    {RectOfCard()}
    <path
        d="M12.5 6.9c1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-.53.12-1.03.3-1.48.54l1.47 1.47c.41-.17.91-.27 1.51-.27zM5.33 4.06L4.06 5.33 7.5 8.77c0 2.08 1.56 3.21 3.91 3.91l3.51 3.51c-.34.48-1.05.91-2.42.91-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c.96-.18 1.82-.55 2.45-1.12l2.22 2.22 1.27-1.27L5.33 4.06z"
        transform="translate(0,2)"
        />
</SvgIcon>
export const NormalCardIcon = () => <SvgIcon style={verticalAlign}>
    {RectOfCard()}
    <circle cx={10} cy={12} r={5}/>
</SvgIcon>

export const IndustryCardIcon = () => <SvgIcon style={verticalAlign}>
    {RectOfCard()}
    <path
        d="M19.43 12.98c.04-.32.07-.64.07-.98 0-.34-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.09-.16-.26-.25-.44-.25-.06 0-.12.01-.17.03l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.06-.02-.12-.03-.18-.03-.17 0-.34.09-.43.25l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98 0 .33.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.09.16.26.25.44.25.06 0 .12-.01.17-.03l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.06.02.12.03.18.03.17 0 .34-.09.43-.25l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zm-1.98-1.71c.04.31.05.52.05.73 0 .21-.02.43-.05.73l-.14 1.13.89.7 1.08.84-.7 1.21-1.27-.51-1.04-.42-.9.68c-.43.32-.84.56-1.25.73l-1.06.43-.16 1.13-.2 1.35h-1.4l-.19-1.35-.16-1.13-1.06-.43c-.43-.18-.83-.41-1.23-.71l-.91-.7-1.06.43-1.27.51-.7-1.21 1.08-.84.89-.7-.14-1.13c-.03-.31-.05-.54-.05-.74s.02-.43.05-.73l.14-1.13-.89-.7-1.08-.84.7-1.21 1.27.51 1.04.42.9-.68c.43-.32.84-.56 1.25-.73l1.06-.43.16-1.13.2-1.35h1.39l.19 1.35.16 1.13 1.06.43c.43.18.83.41 1.23.71l.91.7 1.06-.43 1.27-.51.7 1.21-1.07.85-.89.7.14 1.13zM12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm0 6c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"
        transform="translate(0,2) scale(0.8)"
    />
</SvgIcon>

export const AestheticsCardIcon = () => <SvgIcon style={verticalAlign}>
    {RectOfCard()}
    <path
        d="M21 5c-1.11-.35-2.33-.5-3.5-.5-1.95 0-4.05.4-5.5 1.5-1.45-1.1-3.55-1.5-5.5-1.5S2.45 4.9 1 6v14.65c0 .25.25.5.5.5.1 0 .15-.05.25-.05C3.1 20.45 5.05 20 6.5 20c1.95 0 4.05.4 5.5 1.5 1.35-.85 3.8-1.5 5.5-1.5 1.65 0 3.35.3 4.75 1.05.1.05.15.05.25.05.25 0 .5-.25.5-.5V6c-.6-.45-1.25-.75-2-1zm0 13.5c-1.1-.35-2.3-.5-3.5-.5-1.7 0-4.15.65-5.5 1.5V8c1.35-.85 3.8-1.5 5.5-1.5 1.2 0 2.4.15 3.5.5v11.5z"
        transform="translate(2,4) scale(0.6)"
    />
</SvgIcon>
export const LegendCardIcon = () => <SvgIcon style={verticalAlign}>
    {RectOfCard()}
    <polygon points = "10,1 4,18 19,6 1,6 16,18"
             transform="translate(1,4) scale(0.8)"

    />
</SvgIcon>
export const FilmCardIcon = () => <SvgIcon style={verticalAlign}>
    {RectOfCard()}
    <text
        x="4"
        y="18"
        fill="black"
        fontSize="14px"
    >F
    </text>
</SvgIcon>
export const PersonCardIcon = () =><SvgIcon style={verticalAlign}>
    {RectOfCard()}
    <text
        x="4"
        y="18"
        fill="black"
        fontSize="14px"
    >P
    </text>
</SvgIcon>
export interface IDiscardHelper {
    elem:JSX.Element
}
export const DiscardIconHelper = ({elem}:IDiscardHelper) => <Badge
    anchorOrigin={{
        vertical: 'top',
        horizontal: 'right',
    }}
    color="secondary"
    badgeContent={'-'}
>
    {elem}
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
