import React from "react";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";
import {formatBuildTime, BUILD_TIME, BUILD_COMMIT} from "../constant/build-info";

/**
 * 抽屉底部的构建时间与 commit。没有注入 define 时（例如测试环境）不渲染，
 * 避免留一条空的分隔线。
 *
 * `mt: auto` 让它在菜单不满一屏时贴住底部；菜单比抽屉高时它会跟着内容一起
 * 滚出视野，所以再钉成 `position: sticky`，永远压在抽屉的下沿。
 */
const BuildInfo = ({label}: {label: string}) => {
    const time = formatBuildTime(BUILD_TIME);
    if (!time && !BUILD_COMMIT) return null;
    // 两段各自 nowrap，窄屏换行只发生在它们之间，不会把 "commit 1a2b3c4" 拆开。
    const segments = [
        time && `${label} ${time}`,
        BUILD_COMMIT && `commit ${BUILD_COMMIT}`,
    ].filter(Boolean) as string[];
    return (
        <Box
            data-testid="drawer-build-info"
            sx={{mt: "auto", position: "sticky", bottom: 0, bgcolor: "background.paper"}}
        >
            <Divider/>
            <Typography
                variant="caption"
                component="div"
                sx={{px: 2, pt: 1, pb: 0.5, color: "text.secondary", fontVariantNumeric: "tabular-nums"}}
            >
                {segments.map((segment, index) => (
                    <Box component="span" key={segment} sx={{whiteSpace: "nowrap"}}>
                        {index > 0 && " · "}
                        {segment}
                    </Box>
                ))}
            </Typography>
        </Box>
    );
};

export default BuildInfo;
