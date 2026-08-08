# TCP 연결 종료 시 TIME_WAIT 상태가 누적되어 포트가 고갈되는 현상을 진단하는 방법은 무엇인가?

`#41` · 네트워크

netstat이나 ss 명령어로 TIME_WAIT 상태의 소켓 개수를 세고 local_port_range 한도와 비교하는 것이다.

위가 위층이다.

| 층 | 설명 |
| --- | --- |
| 소켓 수 계측 | ss -s 또는 netstat -antp \| grep TIME_WAIT |
| 포트 한도 확인 | sysctl net.ipv4.ip_local_port_range |
| 에러 로그 진단 | Cannot assign requested address 발생 여부 |

시스템에서 사용할 수 있는 에페머럴 포트 범위는 한정되어 있다. 같은 상대에게 쓸 수 있는 포트 조합이 TIME_WAIT로 다 차면 새 연결에서 EADDRNOTAVAIL이 난다. 상대가 다르면 같은 포트를 다시 쓸 수 있다.

주로 요청을 보낸 클라이언트나 백엔드 API를 호출하는 서비스에서 능동적 닫기(Active Close)를 연속으로 수행할 때 이 현상이 나타난다. 따라서 소켓 수뿐만 아니라 어떤 프로세스가 능동적 닫기를 주도하는지 확인해야 한다.

실무에서는 진단 이후 해결책으로 `net.ipv4.tcp_tw_reuse` 커널 설정 적용이나 커넥션 풀ing, HTTP Keep-Alive 도입을 검토하게 된다.

---

**[꼬리를 물고 더 파고들기 →](https://cs-pathfinder.vercel.app/q/41)** · [네트워크 목록](README.md) · [전체 목록](../README.md)

> 이 글은 대부분 AI가 썼다. 틀린 곳을 찾으면 이슈로 알려 주면 고친다.
> 도식은 서비스에서 그림으로 그려진다. 여기서는 GitHub이 그릴 수 있는 표와 목록으로 옮겼다.
