# node cache memory monitor
노드의 cache메모리의 사용량을 모니터링 해서 일정 수준이상이 일정 시간 이상 지속되면 drop하는 유틸

## 설정 파일 (예시)
```
  dryRun: true
  actionBuffer: 300000
  ratioForPageCacheDrop: 
    duration: 600000
    ratio: 50
  ratioForAllDrop: 
    duration: 300000
    ratio: 70
  processInterval: 60000
  swapOffStartTime: "02:30+09:00"
  swapOffEndTime: "02:40+09:00"
  elasticSearch: 
    host: 10.0.0.2
    port: 9200
    memoryIndex: mem-log
    useApiKey: false
  prometheus: 
    url: http://10.0.0.1
    nodeSelector: "worker=true"
  ssh:
    sshPemFile: "/home/ShaunPark/my.pem"
    sshUser: "ubuntu"
    useIpAddress: true
```
  - dryRun: 실제 drop 작업 실행 여부. true이면 모니터링만 하고 실제 drop작업을 실행하지 않음
  - actionBuffer: drop 작업 실행 후에 다음 drop 작업까지의 최소 시간. 노드별로 계산됨. 밀리초 단위
  - ratioForPageCacheDrop: Page cache만 drop하는 조건
    - duration: 이 시간동안 아래 비율이상의 swap/cache 메모리가 사용되면 page cache drop을 수행. 밀리초 단위
    - ratio: drop 작업 실행 조건. 퍼센트로 표시
  - ratioForAllDrop: Page cache와 inode를 모두 drop하는 조건  
    - duration:  이 시간동안 아래 비율이상의 swap/cache 메모리가 사용되면 page cache 및 inode drop을 수행. 밀리초 단위
    - ratio: drop 작업 실행 조건. 퍼센트로 표시
  - processInterval: 메모리 확인 주기. 밀리초 단위. 1분(600000) 권장
  - swapOffStartTime: 주기적으로 swap을 껐다 키는 작업 시간대 시작 시각. 예시) "02:30+09:00"
  - swapOffEndTime:  주기적으로 swap을 껐다 키는 작업 시간대 종료 시각. 예시) "02:40+09:00"
  - elasticSearch: elastic search에 로그를 남기기 위한 정보
    - host: host 명 혹은 ip 주소
    - port: 포트 번호
    - memoryIndex: 인덱스 몇
    - useApiKey: 인증 방식을 api키를 사용하는지 여부를 설정. true인 경우 apiKey, false인경우 id 가 설정되어야 함.
    - apiKey: elastic search를 접근하기 위한 api key (선택사항)
    - id : elastic search 계정(선택사항). apiKey를 사용하거나 계정이 필요 없으면 생략 가능. 비밀번호는 환경변수 ES_PASSWORD로 제공해야 함.
  - prometheus: 프로메테우스 정보
    - url: 프로메테우스 접속 url
    - nodeSelector: 노드정보 중에서 원하는 노드만 선택하기 위한 selector. 필수이며 하나의 레이블만 지원함. 예시)"worker=true"
  - ssh: drop 작업을 위한 ssh 접속 정보
    - sshPemFile: ssh 접속을 위한 pem key파일 위치
    - sshUser: ssh 접속을 위한 아이디
    - useIpAddress: ip주소로 접속할 것인지 여부, false이면 노드명으로 접속시도.

