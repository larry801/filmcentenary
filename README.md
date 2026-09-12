# 电影百年/宋金战争 网页版

用[boardgame.io](https://boardgame.io)框架实现的桌游网页版

## 启动

先安装依赖 要求 node 20.19 以上（vite 8 需要 ^20.19 或 >=22.12，Docker 镜像使用 node 22）
```shell
yarn install
```

打开本地版 （远程多人不可用 /local4p 可用于测试）
```shell
yarn start
```

启动远程多人可用版本
```shell
yarn serve
```

## 结构

主要逻辑在 src/game/util.ts

## 调试日志

游戏本身写了很多日志（每一步移动、每次计分、每个地区排名），默认全部关闭，
因为在大后期状态下生成这些字符串会明显拖慢界面。

需要排查对局时再打开：

* 浏览器：控制台执行 `localStorage.setItem('filmDebug', '1')` 后刷新，
  或临时执行 `window.__FILM_DEBUG__ = true`（无需刷新）
* 服务端：`FILM_DEBUG=1 yarn serve`

## 性能

`perf/` 目录下是性能测试脚本（不参与 `yarn test`），见 `perf/README.md`。