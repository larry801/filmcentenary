# 电影百年 / 宋金战争 / Virgin Queen 网页版

用[boardgame.io](https://boardgame.io)框架实现的桌游网页版

## 启动

先安装依赖 要求 node 20.19 以上（vite 8 需要 ^20.19 或 >=22.12，Docker 镜像使用 node 22）
```shell
yarn install
```

打开本地版 （远程多人不可用 /local4p、/local、/localVQ 可用于测试）
```shell
yarn start
```

启动远程多人可用版本
```shell
yarn serve
```

## 镜像

master 分支的 CI（`.github/workflows/ci.docker.yml`）会构建并推送三个镜像：

- `ghcr.io/larry801/film-centenary`：应用镜像（`docker-compose.yml` 使用）
- `ghcr.io/larry801/film-centenary-base`：运行时依赖层
- `ghcr.io/larry801/film-centenary-builder`：构建层

同一个镜像也会同步推到 Docker Hub 的 `larry801/` 下。GHCR 上的包目前是公开的，
可以直接匿名 `docker pull`；如果以后把包改成私有，部署机器拉取前需要先登录：

```shell
echo "$GHCR_TOKEN" | docker login ghcr.io -u <你的用户名> --password-stdin
```

## 结构

- 电影百年：`src/game/`
- 宋金战争：`src/songJinn/`
- Virgin Queen：`src/virginQueen/`（说明见 `VIRGIN_QUEEN.md`）

电影百年主要逻辑在 src/game/util.ts。

## 调试日志

游戏本身写了很多日志（每一步移动、每次计分、每个地区排名），默认全部关闭，
因为在大后期状态下生成这些字符串会明显拖慢界面。

需要排查对局时再打开：

* 浏览器：控制台执行 `localStorage.setItem('filmDebug', '1')` 后刷新，
  或临时执行 `window.__FILM_DEBUG__ = true`（无需刷新）
* 服务端：`FILM_DEBUG=1 yarn serve`

## 性能

`perf/` 目录下是性能测试脚本（不参与 `yarn test`），见 `perf/README.md`。