-- 난이도. 판정 기준(rubric)은 data/levels.ts에 명문화돼 있다.
--
-- 정답률 실측이 아니라 기준 기반 판정이다 -- 트래픽이 없어 실측 근거가
-- 아직 없다. prerequisite 사슬 깊이(구조)와 사용자 행동(트래픽 후)으로
-- 보정할 계획이고, 그 계획도 levels.ts에 있다.
--
-- nullable로 둔다. 미판정 노드(새로 생긴 것)는 없음이 정직하다.
-- text로 두는 이유는 tags와 같다 -- 322행 규모에서 enum 마이그레이션의
-- 경직이 이득보다 크고, 어휘 검증은 시험이 파일 차원에서 한다.
alter table qnode add column level text;
