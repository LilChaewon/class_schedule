# 빌드 단계가 필요 없는 정적 앱(React+Babel CDN). nginx 로 그대로 서빙합니다.
FROM nginx:1.27-alpine

# nginx 설정 + 정적 파일
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY public/ /usr/share/nginx/html/

# 컨테이너 기동 시 환경변수로 config.js 를 생성하는 진입 스크립트
COPY docker-entrypoint.sh /docker-entrypoint.d/40-generate-config.sh
RUN chmod +x /docker-entrypoint.d/40-generate-config.sh

EXPOSE 80
# nginx:alpine 의 기본 entrypoint 가 /docker-entrypoint.d/*.sh 를 실행한 뒤 nginx 를 띄웁니다.
