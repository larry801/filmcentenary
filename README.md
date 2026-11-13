# 电影百年 / 宋金战争 / Virgin Queen 网页版

用[boardgame.io](https://boardgame.io)框架实现的桌游网页版

## 启动

先安装依赖 要求 node 20.19 以上（vite 8 需要 ^20.19 或 >=22.12，Docker 镜像使用 node 22）
```shell
yarn install
```

打开本地版 （远程多人不可用 /local4p、/local、/localVQ、/localIE 可用于测试）
```shell
yarn start
```

启动远程多人可用版本
```shell
yarn serve
```

## 镜像

CI 分成两个 workflow：

- `.github/workflows/ci.yml`：单元测试、类型检查、生产构建和 Playwright E2E，
  跑在 `master` 以及 `feature/**`、`fix/**`、`refactor/**`、`test/**` 分支上
  （也响应指向 `master` 的 pull request）。
- `.github/workflows/release.yml`：只有 `master` 会构建并推送三个镜像：

  - `ghcr.io/larry801/film-centenary`：应用镜像（`docker-compose.yml` 使用）
  - `ghcr.io/larry801/film-centenary-base`：运行时依赖层
  - `ghcr.io/larry801/film-centenary-builder`：构建层

同一个镜像也会同步推到 Docker Hub 的 `larry801/` 下。GHCR 上的包目前是公开的，
可以直接匿名 `docker pull`；如果以后把包改成私有，部署机器拉取前需要先登录：

```shell
echo "$GHCR_TOKEN" | docker login ghcr.io -u <你的用户名> --password-stdin
```

CI 在推送之前会先在本机上把应用镜像跑起来并请求 `/`，确认镜像真的能启动后才会推送
（运行时镜像只装生产依赖，**服务端代码不能引用 devDependencies**）。

## 部署（VPS）

VPS 上只跑镜像，不在主机上编译。`deploy/docker-compose.yml` 就是部署文件，
对局数据通过 `./data` 挂载（boardgame.io FlatFile，不走数据库）：

```shell
mkdir -p /opt/filmcentenary/data      # 首次部署，放入已有对局数据
cp deploy/docker-compose.yml /opt/filmcentenary/
cd /opt/filmcentenary
docker compose pull && docker compose up -d
```

发布新版本：CI 推送 `latest` 后在 VPS 上执行 `docker compose pull && docker compose up -d`。
容器内服务监听 3000，宿主机映射到 3000（与原 systemd 版本一致）。

## 结构

- 电影百年：`src/game/`
- 宋金战争：`src/songJinn/`
- Virgin Queen：`src/virginQueen/`（说明见 `VIRGIN_QUEEN.md`）
- Imperial Elegy：`src/imperialElegy/`（说明见 `docs/imperial-elegy/README.md`）

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

## 测试

`yarn test` 会跑完整的 Jest 套件（223 个文件、1300+ 个用例，约 1 分钟）。

Jest 在每个 worker 进程里都要重新加载一遍被 import 的模块，因此 **模块顶层的
计算会按进程重复进行**。修改地图/布局一类在 import 时算好的数据时请注意：

* import 期不能跑重计算。`relaxMapPoints` 用网格只比较可能互相重叠的标记，
  结果与原先的全比较实现完全一致（`map.test.tsx` 用
  `data/decluttered-space-points.json` 锁定布局）。
* 同一进程内重复使用的派生数据要缓存。`cachedBoardWarpPath` 缓存棋盘海岸线
  的形变结果，因为棋盘每次走子都会重绘。