# 更新

不要每天追 `latest`。官方云一天多个版本，不等于这台机器的镜像已经能跑。看 https://lobehub.com/changelog ，有网关、鉴权、数据库相关再更新。建议每周一次，或有明确需要时再做。

在 jdy1 上：

```bash
cd /opt/lobehub
cp .env /root/lobehub.env.$(date +%F).bak
chmod 600 /root/lobehub.env.*.bak
docker compose pull
docker compose up -d
docker logs lobehub 2>&1 | tail -40
```

看到 `database migration pass` 和 `Ready` 才算完。

## 什么时候还要改文件

只拉镜像不够的情况：官方 compose 新增了服务或环境变量（例如曾经新增 gateway）。对照：

https://github.com/lobehub/lobehub/blob/HEAD/docker-compose/deploy/docker-compose.yml

把新增项合并进本目录的 `docker-compose.yml`，保留这些 jdy1 约束：

- Agent Gateway 宿主机端口继续是 `127.0.0.1:9989:8787`
- `AGENT_GATEWAY_INTERNAL_URL` 继续是 `http://gateway:8787`
- Postgres、Redis 继续不映射宿主机端口
- 不恢复官方模板里的 `5432:5432` 和 `8787:8787`

密钥（`KEY_VAULTS_SECRET`、`AUTH_SECRET`、`JWKS_KEY`、`POSTGRES_PASSWORD`）升级时不能换。

## 备份

```bash
cd /opt/lobehub
docker exec lobe-postgres pg_dump -U postgres -d lobechat | gzip > /root/lobechat-$(date +%F).sql.gz
```

`.env` 和这份 dump 分开存。丢了 `.env`，dump 里的加密字段也解不开。

## 回滚

```bash
cd /opt/lobehub
docker compose down
# 把 lobe 服务的 image 改成上一个能跑的标签后再 up
docker compose up -d
```

`down` 不加 `-v`。加了 `-v` 会删 Redis 卷。Postgres 数据在 `./data`，不要删这个目录。
