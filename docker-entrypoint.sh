#!/bin/sh

# 初始化 banner 目录 - 如果挂载目录为空，复制默认文件
BANNER_DIR="/app/dist/static/banner"
BANNER_SOURCE="/app/banner-defaults"

if [ -d "$BANNER_SOURCE" ]; then
    for file in "$BANNER_SOURCE"/*.jpg; do
        if [ -f "$file" ]; then
            filename=$(basename "$file")
            # 如果目标文件不存在，则复制
            if [ ! -f "$BANNER_DIR/$filename" ]; then
                cp "$file" "$BANNER_DIR/$filename"
                echo "[INIT] Copied default banner: $filename"
            fi
        fi
    done
fi

# 启动服务器
exec node --experimental-sqlite server/index.js
