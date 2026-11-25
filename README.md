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
  跑在 `feature/**`、`fix/**`、`refactor/**`、`test/**`、`perf/**` 分支上，以及指向 `master`
  的 pull request。**`master` 上的 push 不跑这套测试**（合并前后已经验证过）。
  E2E 只剩一个 `e2e-app` job：默认套件跑在 Vite dev server 上（大厅、Virgin
  Queen 与共享卡表），不需要 `build` 产物，push 后立即启动。帝国挽歌的四个
  专用套件（回归 / 控件 / 观战 / 手机）随极简界面改版一起删除，见
  `docs/imperial-elegy/MINIMAL_UI.md`。

  E2E 不在 runner 上装浏览器。`ci.yml` 先由 `playwright-image` job 构建
  （或复用）`Dockerfile.playwright` 定义的测试镜像：Node 22、Chromium
  headless shell 及其系统依赖、预热的 Yarn 缓存。`e2e-app` 用 `container:`
  直接跑在这个镜像里，工作目录就是 runner 挂载的 checkout；再用
  `yarn install --offline` 从镜像缓存里链接 `node_modules`，所以一次运行既不
  下载浏览器也不访问 npm。镜像 tag 由 `Dockerfile.playwright`（含紧随其后的
  `.dockerignore`）、`package.json`、`yarn.lock` 的内容哈希决定：只改源码会
  复用已发布的镜像，改了这几个文件才会重新构建并推到
  `ghcr.io/larry801/film-centenary-playwright`。

  注意发布镜像需要 `packages: write`，fork 来的 PR 拿不到这个权限，这类 PR
  要维护者先在主仓库分支上跑一次；同仓库分支和 PR 不受影响。

  本地想复现 CI 的浏览器环境，可以直接构建并进入这个镜像（源码目录挂到
  `/app`）：

  ```shell
  docker build -f Dockerfile.playwright -t film-centenary-playwright .
  docker run --rm -it -v "$PWD:/app" -w /app film-centenary-playwright bash
  # 容器内：
  yarn install --frozen-lockfile --offline
  yarn test:e2e
  ```

  注意 worker 数在 CI 是 3，不是 4：`ubuntu-24.04` runner 报 4 vCPU 但实际是
  2 个物理核，实测第 4 个 worker 会让每条测试慢 30–40%、整套反而从 2.8 min
  变 3.0 min。需要时可以设 `E2E_WORKERS` 覆盖。
- `.github/workflows/release.yml`：`master` 上只做 Docker 构建与推送，不跑测试。
  会构建并推送三个镜像：

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

## 部署（Nodaroo）

Nodaroo 用的是 Pterodactyl 一类面板，没有 Dockerfile：它先跑一遍 `npm install`，再用
`node` 启动 `MAIN_FILE`。为了让面板上不需要安装依赖、也不需要编译，这里部署的是一个
**零依赖的单文件服务端**：`server.ts` 连同它引用的整棵 TS/JS 代码树和全部 npm 包打成一个
`build/server.js`，放进面板用 `node` 直接跑。

在仓库根目录生成：

```shell
yarn install
yarn build         # 前端 → build/
yarn build:single  # 服务端 → build/server.js（约 9 MB，依赖全部内联）
```

面板上的设置：

| 变量 | 值 |
| --- | --- |
| `MAIN_FILE` | `server.js` |
| `PORT` | 可选。面板分配的 `25664` 已经打进包里，设了会覆盖它 |
| `DB_DIR` | 可选。不设是纯内存，容器重启对局就没了；填 `/home/container/data` 才会落盘 |
| `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD` | `1`：面板那次 `npm install` 会连 `@playwright/test` 一起装，没必要下载 Chromium |

放文件：

1. `build/server.js` 传到 `/home/container/server.js`
2. `build/` 里除 `server.js` 以外的内容（`index.html`、`assets/`、`img/`、`vq-cards/`、
   `imperial-elegy/`）传成 `/home/container/build/`——前端就是这些静态文件，服务端按相对路径
   直接服务它们
3. 启动

端口默认值写在 `vite.server.config.mts` 的 `define` 里（现在是 `25664`），面板换了端口就改那
一行再 `yarn build:single`；`PORT` / `SERVER_PORT` 环境变量仍然优先。

关于"零依赖"的边界，说清楚免得误会：

- 服务端真的不依赖 `node_modules`：包里内联了 koa-static、boardgame.io、ioredis、pg 等
  全部运行时依赖，`pg-native` 是唯一的外置项，`pg` 只是可选地加载它，面板用的 FlatFile
  存储不会走到
- 前端产物不会打进那个 js，`build/` 要单独传。改了代码就要重新 `yarn build` +
  `yarn build:single` 再覆盖一次

`package-lock.json` 与 `package.json` 保持同步（由 npm 生成）。面板每次启动都会
`npm install`，锁文件一旦被改写，工作区就脏了，之后的 `git pull` 会被 git 拒绝。

`ci.yml` 的 `build` job 打完这个单文件后会把 `build/` 复制到一个**没有 node_modules**
的临时目录里用 `node` 起一次，请求 `/` 和 `/api/match-stats`，所以内联漏了依赖或者打包
产物跑不起来，会在 CI 里先暴露。

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

## 作者的话

新增作者自制，有开关，可自选添加
