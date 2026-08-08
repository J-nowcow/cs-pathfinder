# 뷰 바인딩은 왜 onDestroyView에서 비우는가?

`#85` · 모바일

Fragment 인스턴스가 백 스택에 남아도 뷰는 먼저 파괴될 수 있기 때문이다. 바인딩을 계속 잡으면 폐기된 뷰가 수집되지 않고 잘못 접근할 수도 있다.

위가 위층이다.

| 층 | 설명 |
| --- | --- |
| Fragment 수명 | onCreate부터 onDestroy까지다 |
| View 수명 | onCreateView부터 onDestroyView까지다 |

뷰를 갱신하는 관찰은 viewLifecycleOwner에 묶는다. 그러면 뷰가 파괴될 때 관찰도 멈춘다.

onDestroyView에서 어댑터와 리스너도 필요에 따라 끊는다. Fragment 필드에는 새 뷰가 생기기 전까지 뷰 참조를 남기지 않는다.

---

**[꼬리를 물고 더 파고들기 →](https://cs-pathfinder.vercel.app/q/85)** · [모바일 목록](README.md) · [전체 목록](../README.md)

> 이 글은 대부분 AI가 썼다. 틀린 곳을 찾으면 이슈로 알려 주면 고친다.
> 도식은 서비스에서 그림으로 그려진다. 여기서는 GitHub이 그릴 수 있는 표와 목록으로 옮겼다.
