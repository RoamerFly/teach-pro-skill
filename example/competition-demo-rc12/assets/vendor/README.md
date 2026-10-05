# 本地回答排版依赖

固定版本：Marked 18.0.14（MIT），DOMPurify 3.4.16（Apache-2.0 / MPL-2.0 双许可）。原始发行文件与许可证随课程部署，不依赖 CDN 或学员安装 npm。

来源：npm 官方 registry 的 marked-18.0.14.tgz、dompurify-3.4.16.tgz。下载时验证 dist.integrity SHA-512 后提取浏览器发行文件；无源码修改。

- Marked 包校验：`sha512-mBHK6FBHuBAlhgRe88w9F0O1AbwwXJUcQibUbC/QcdTbVGAD7aWza+xt3N6oT/jCZx3/OMeS+8rnuiHZcQ9s7A==`
- DOMPurify 包校验：`sha512-sqo+pNp3qRhCIpbgRi1y8Tgk27Bo2Ry7w0dC1NBeNTdZChWjz9Xb/KOoZbRP/R6pQZ80Qw8YhXw13hWWBbMRnQ==`

升级时重新核实来源、许可和测试，不直接修改发行脚本。
