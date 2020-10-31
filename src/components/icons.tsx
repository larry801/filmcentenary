import React from "react";
import SvgIcon from "@material-ui/core/SvgIcon";

export const ActionPointIcon = () => <SvgIcon>
    <svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="24" height="24"  viewBox="0 0 24 24">
        <path d="
             M6 6
             A6,3 0 0,0 18,6
             A6,3 0 0,0 6,6
             L6, 18
             A6,3,0 0,0 18,18
             L18, 6
             "
              style={{
                  stroke:"#000000",
                  fill:"#ffffff",
                  strokeWidth:2,
              }}/>
    </svg>
</SvgIcon>
