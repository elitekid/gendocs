# BookStore API 연동 명세서

> **프로젝트**: BookStore Open API Platform
> **버전**: v1.0
> **작성일**: 2026-01-15
> **작성자**: API개발팀

---

## 목차

1. [시스템 구성](#1-시스템-구성)
2. [API 목록 요약](#2-api-목록-요약)
3. [공통 사항](#3-공통-사항)
4. [도서 관리 API](#4-도서-관리-api)
5. [Webhook API](#5-webhook-api)
6. [연동 가이드](#6-연동-가이드)

---

## 변경 이력

| 버전 | 날짜 | 작성자 | 변경 내용 |
|------|------|--------|----------|
| v1.0 | 2026-01-15 | API개발팀 | 초안 작성 |

---

## 1. 시스템 구성

```
┌──────────────┐      HTTPS/JSON      ┌──────────────────────┐
│  클라이언트    │ ◄──────────────────► │   API Gateway        │
│  (Web/App)   │                      │   (인증/Rate Limit)   │
└──────────────┘                      └──────────┬───────────┘
                                                 │
                                      ┌──────────┴───────────┐
                                      │  BookStore API Server │
                                      │  (비즈니스 로직)       │
                                      └──────────┬───────────┘
                                                 │
                                  ┌──────────────┼──────────────┐
                                  │              │              │
                           ┌──────┴─────┐ ┌─────┴──────┐ ┌────┴─────┐
                           │  DB (RDB)  │ │  검색엔진   │ │  Cache   │
                           │  도서/주문  │ │(Fulltext)  │ │ (Redis)  │
                           └────────────┘ └────────────┘ └──────────┘
                                                 │
                                      ┌──────────┴───────────┐
                                      │  Webhook Dispatcher  │
                                      │  (비동기 알림 발송)    │
                                      └──────────────────────┘
```

### 환경별 URL

| 환경 | API Base URL | Webhook Callback URL |
|------|-------------|---------------------|
| 개발 | https://dev-api.bookstore.example.com | https://dev-webhook.partner.example.com |
| 스테이징 | https://stg-api.bookstore.example.com | https://stg-webhook.partner.example.com |
| 운영 | https://api.bookstore.example.com | https://webhook.partner.example.com |

> 참고: 개발 환경은 사전 신청 후 접속 가능합니다. 운영 환경 접속 시 IP 화이트리스트 등록이 필요합니다.

---

## 2. API 목록 요약

### 2.1 도서 관리 API (Request) - 5개

| No | API명 | Method | 엔드포인트 | 설명 |
|----|-------|--------|-----------|------|
| B1 | [도서 목록 조회](#41-도서-목록-조회) | GET | `/api/v1/books` | 전체 도서 목록 페이징 조회 |
| B2 | [도서 상세 조회](#42-도서-상세-조회) | GET | `/api/v1/books/{id}` | 도서 단건 상세 조회 |
| B3 | [도서 등록](#43-도서-등록) | POST | `/api/v1/books` | 신규 도서 등록 |
| B4 | [도서 수정](#44-도서-수정) | PUT | `/api/v1/books/{id}` | 기존 도서 정보 수정 |
| B5 | [도서 검색](#45-도서-검색) | GET | `/api/v1/books/search` | 키워드 기반 도서 검색 |

### 2.2 Webhook API (Notification) - 2개

| No | API명 | 설명 | Callback 엔드포인트 |
|----|-------|------|-------------------|
| W1 | [주문 알림](#51-주문-알림) | 주문 접수/상태 변경 시 알림 | `POST /webhook/order` (파트너 제공) |
| W2 | [재고 알림](#52-재고-알림) | 재고 부족/소진 시 알림 | `POST /webhook/inventory` (파트너 제공) |

---

## 3. 공통 사항

### 3.1 통신 방식

| 항목 | 내용 |
|------|------|
| 프로토콜 | HTTPS (TLS 1.2 이상) |
| Content-Type | `application/json; charset=UTF-8` |
| 인코딩 | UTF-8 |
| 타임아웃 | 연결 5초 / 읽기 30초 |

### 3.2 인증 방식

Bearer Token 기반 인증을 사용합니다. 모든 API 요청 시 HTTP 헤더에 발급받은 토큰을 포함해야 합니다.

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

> 주의: 토큰은 발급 후 24시간 유효합니다. 만료된 토큰으로 요청 시 `401 Unauthorized`가 반환되며, 토큰 재발급이 필요합니다.

#### 토큰 발급 요청

```json
{
  "clientId": "your-client-id",
  "clientSecret": "your-client-secret",
  "grantType": "client_credentials"
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| clientId | String | Y | 발급받은 클라이언트 ID |
| clientSecret | String | Y | 발급받은 클라이언트 시크릿 |
| grantType | String | Y | 인증 유형 (고정값: `client_credentials`) |

#### 토큰 발급 응답

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "tokenType": "Bearer",
  "expiresIn": 86400
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| accessToken | String | 접근 토큰 (JWT) |
| tokenType | String | 토큰 유형 (`Bearer`) |
| expiresIn | Integer | 만료 시간 (초 단위, 기본 86400 = 24시간) |

### 3.3 공통 응답 코드

| HTTP 상태 코드 | 응답 코드 | 설명 |
|---------------|----------|------|
| 200 | SUCCESS | 정상 처리 |
| 400 | BAD_REQUEST | 요청 파라미터 오류 |
| 401 | UNAUTHORIZED | 인증 실패 (토큰 없음 또는 만료) |
| 403 | FORBIDDEN | 권한 없음 |
| 404 | NOT_FOUND | 리소스 없음 |
| 409 | CONFLICT | 중복 요청 (ISBN 중복 등) |
| 429 | TOO_MANY_REQUESTS | 요청 한도 초과 |
| 500 | INTERNAL_ERROR | 서버 내부 오류 |

### 3.4 공통 객체

#### PageInfo (페이지 정보)

```json
{
  "page": 1,
  "size": 20,
  "totalElements": 153,
  "totalPages": 8
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| page | Integer | 현재 페이지 번호 (1부터 시작) |
| size | Integer | 페이지당 항목 수 |
| totalElements | Integer | 전체 항목 수 |
| totalPages | Integer | 전체 페이지 수 |

#### ErrorResponse (오류 응답)

```json
{
  "code": "BAD_REQUEST",
  "message": "isbn 필드는 필수입니다.",
  "timestamp": "2026-01-15T10:30:00+09:00",
  "traceId": "abc-123-def-456"
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| code | String | 응답 코드 (3.3 참조) |
| message | String | 상세 오류 메시지 |
| timestamp | String | 오류 발생 시각 (ISO 8601) |
| traceId | String | 추적 ID (문의 시 제공) |

> 참고: `traceId`는 모든 응답에 포함됩니다. 오류 발생 시 해당 값을 전달하면 원인 분석이 빨라집니다.

---

## 4. 도서 관리 API

### 4.1 도서 목록 조회

전체 도서 목록을 페이징하여 조회합니다.

#### 기본 정보

| 항목 | 내용 |
|------|------|
| 엔드포인트 | `GET /api/v1/books` |
| 설명 | 전체 도서 목록 페이징 조회 |
| 인증 | Bearer Token 필수 |

#### Request (Query Parameters)

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| page | Integer | N | 페이지 번호 (기본값: 1) |
| size | Integer | N | 페이지당 항목 수 (기본값: 20, 최대: 100) |
| sort | String | N | 정렬 기준 (`title`, `publishedDate`, `price`) |
| order | String | N | 정렬 방향 (`asc`, `desc`, 기본값: `asc`) |
| category | String | N | 카테고리 필터 (예: `fiction`, `technology`) |

#### Response Body

```json
{
  "code": "SUCCESS",
  "data": {
    "items": [
      {
        "id": "book-001",
        "isbn": "978-89-1234-567-8",
        "title": "클라우드 아키텍처 설계 패턴",
        "author": "김서준",
        "publisher": "한빛미디어",
        "price": 32000,
        "category": "technology",
        "publishedDate": "2025-11-20",
        "stockQuantity": 150,
        "status": "ON_SALE"
      }
    ],
    "pageInfo": {
      "page": 1,
      "size": 20,
      "totalElements": 153,
      "totalPages": 8
    }
  }
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| code | String | 응답 코드 |
| data.items[] | Array | 도서 목록 |
| data.items[].id | String | 도서 고유 ID |
| data.items[].isbn | String | ISBN-13 |
| data.items[].title | String | 도서명 |
| data.items[].author | String | 저자명 |
| data.items[].publisher | String | 출판사 |
| data.items[].price | Integer | 정가 (원) |
| data.items[].category | String | 카테고리 |
| data.items[].publishedDate | String | 출간일 (YYYY-MM-DD) |
| data.items[].stockQuantity | Integer | 재고 수량 |
| data.items[].status | String | 판매 상태 (`ON_SALE`, `SOLD_OUT`, `DISCONTINUED`) |
| data.pageInfo | Object | 페이지 정보 (3.4 PageInfo 참조) |

### 4.2 도서 상세 조회

도서 ID로 단건 상세 정보를 조회합니다.

#### 기본 정보

| 항목 | 내용 |
|------|------|
| 엔드포인트 | `GET /api/v1/books/{id}` |
| 설명 | 도서 단건 상세 조회 |
| 인증 | Bearer Token 필수 |

#### Path Parameters

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| id | String | Y | 도서 고유 ID |

#### Response Body

```json
{
  "code": "SUCCESS",
  "data": {
    "id": "book-001",
    "isbn": "978-89-1234-567-8",
    "title": "클라우드 아키텍처 설계 패턴",
    "author": "김서준",
    "publisher": "한빛미디어",
    "price": 32000,
    "discountPrice": 28800,
    "category": "technology",
    "description": "대규모 시스템을 위한 클라우드 아키텍처 설계 패턴을 다룹니다. MSA, 이벤트 드리븐, CQRS 등 핵심 패턴을 실무 사례와 함께 설명합니다.",
    "tableOfContents": "1장. 클라우드 기초\n2장. MSA 패턴\n3장. 이벤트 드리븐\n4장. CQRS와 이벤트 소싱",
    "pages": 480,
    "publishedDate": "2025-11-20",
    "stockQuantity": 150,
    "status": "ON_SALE",
    "tags": ["cloud", "architecture", "msa", "design-pattern"],
    "createdAt": "2025-12-01T09:00:00+09:00",
    "updatedAt": "2026-01-10T14:30:00+09:00"
  }
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| data.discountPrice | Integer | 할인가 (원, null이면 할인 없음) |
| data.description | String | 도서 소개 |
| data.tableOfContents | String | 목차 (줄바꿈 구분) |
| data.pages | Integer | 총 페이지 수 |
| data.tags | String[] | 태그 목록 |
| data.createdAt | String | 등록 일시 (ISO 8601) |
| data.updatedAt | String | 최종 수정 일시 (ISO 8601) |

> 참고: 목록 조회(4.1)의 응답 필드에 추가로 `discountPrice`, `description`, `tableOfContents`, `pages`, `tags`, `createdAt`, `updatedAt` 필드가 포함됩니다.

### 4.3 도서 등록

신규 도서를 등록합니다.

#### 기본 정보

| 항목 | 내용 |
|------|------|
| 엔드포인트 | `POST /api/v1/books` |
| 설명 | 신규 도서 등록 |
| 인증 | Bearer Token 필수 |
| 권한 | ADMIN 역할 필요 |

#### Request Body

```json
{
  "isbn": "978-89-9876-543-2",
  "title": "실전 분산 시스템 설계",
  "author": "이하늘",
  "publisher": "위키북스",
  "price": 38000,
  "discountPrice": 34200,
  "category": "technology",
  "description": "분산 시스템의 핵심 개념부터 실무 적용까지 단계별로 다룹니다.",
  "tableOfContents": "1장. 분산 시스템 개요\n2장. CAP 이론\n3장. 합의 알고리즘",
  "pages": 520,
  "publishedDate": "2026-01-10",
  "stockQuantity": 200,
  "tags": ["distributed-system", "architecture", "backend"]
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| isbn | String | Y | ISBN-13 (하이픈 포함 17자리) |
| title | String | Y | 도서명 (최대 200자) |
| author | String | Y | 저자명 (최대 100자) |
| publisher | String | Y | 출판사명 (최대 100자) |
| price | Integer | Y | 정가 (원, 0 이상) |
| discountPrice | Integer | N | 할인가 (원, `price` 이하) |
| category | String | Y | 카테고리 코드 |
| description | String | N | 도서 소개 (최대 2000자) |
| tableOfContents | String | N | 목차 (줄바꿈 구분) |
| pages | Integer | N | 총 페이지 수 |
| publishedDate | String | Y | 출간일 (YYYY-MM-DD) |
| stockQuantity | Integer | Y | 초기 재고 수량 (0 이상) |
| tags | String[] | N | 태그 목록 (최대 10개) |

> 주의: `isbn`은 시스템 전체에서 유일해야 합니다. 중복 ISBN으로 등록 시 `409 CONFLICT`가 반환됩니다.

#### Response Body

```json
{
  "code": "SUCCESS",
  "data": {
    "id": "book-042",
    "isbn": "978-89-9876-543-2",
    "title": "실전 분산 시스템 설계",
    "status": "ON_SALE",
    "createdAt": "2026-01-15T10:30:00+09:00"
  }
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| data.id | String | 생성된 도서 고유 ID |
| data.isbn | String | 등록된 ISBN |
| data.title | String | 등록된 도서명 |
| data.status | String | 초기 판매 상태 (`ON_SALE`) |
| data.createdAt | String | 등록 일시 |

### 4.4 도서 수정

기존 도서의 정보를 수정합니다. 전달된 필드만 업데이트됩니다(Partial Update).

#### 기본 정보

| 항목 | 내용 |
|------|------|
| 엔드포인트 | `PUT /api/v1/books/{id}` |
| 설명 | 기존 도서 정보 수정 |
| 인증 | Bearer Token 필수 |
| 권한 | ADMIN 역할 필요 |

#### Path Parameters

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| id | String | Y | 도서 고유 ID |

#### Request Body

```json
{
  "price": 35000,
  "discountPrice": 31500,
  "stockQuantity": 300,
  "status": "ON_SALE",
  "tags": ["distributed-system", "architecture", "backend", "bestseller"]
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| title | String | N | 도서명 |
| price | Integer | N | 정가 (원) |
| discountPrice | Integer | N | 할인가 (원) |
| stockQuantity | Integer | N | 재고 수량 |
| status | String | N | 판매 상태 (`ON_SALE`, `SOLD_OUT`, `DISCONTINUED`) |
| tags | String[] | N | 태그 목록 (전체 교체) |

> 참고: `isbn`, `author`, `publisher`, `publishedDate`는 수정할 수 없습니다. 변경이 필요한 경우 도서를 삭제 후 재등록하십시오.

#### Response Body

```json
{
  "code": "SUCCESS",
  "data": {
    "id": "book-042",
    "title": "실전 분산 시스템 설계",
    "updatedFields": ["price", "discountPrice", "stockQuantity", "status", "tags"],
    "updatedAt": "2026-01-15T15:00:00+09:00"
  }
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| data.id | String | 수정된 도서 ID |
| data.title | String | 도서명 |
| data.updatedFields | String[] | 실제 변경된 필드 목록 |
| data.updatedAt | String | 수정 일시 |

### 4.5 도서 검색

키워드 기반으로 도서를 검색합니다. 제목, 저자, 출판사, 태그를 대상으로 검색합니다.

#### 기본 정보

| 항목 | 내용 |
|------|------|
| 엔드포인트 | `GET /api/v1/books/search` |
| 설명 | 키워드 기반 도서 검색 |
| 인증 | Bearer Token 필수 |

#### Request (Query Parameters)

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| q | String | Y | 검색 키워드 (최소 2자) |
| field | String | N | 검색 대상 필드 (`title`, `author`, `publisher`, `tag`, `all`). 기본값: `all` |
| category | String | N | 카테고리 필터 |
| minPrice | Integer | N | 최소 가격 |
| maxPrice | Integer | N | 최대 가격 |
| status | String | N | 판매 상태 필터 |
| page | Integer | N | 페이지 번호 (기본값: 1) |
| size | Integer | N | 페이지당 항목 수 (기본값: 20) |

#### Response Body

```json
{
  "code": "SUCCESS",
  "data": {
    "items": [
      {
        "id": "book-001",
        "isbn": "978-89-1234-567-8",
        "title": "클라우드 아키텍처 설계 패턴",
        "author": "김서준",
        "publisher": "한빛미디어",
        "price": 32000,
        "category": "technology",
        "publishedDate": "2025-11-20",
        "stockQuantity": 150,
        "status": "ON_SALE",
        "matchScore": 0.95
      },
      {
        "id": "book-042",
        "isbn": "978-89-9876-543-2",
        "title": "실전 분산 시스템 설계",
        "author": "이하늘",
        "publisher": "위키북스",
        "price": 38000,
        "category": "technology",
        "publishedDate": "2026-01-10",
        "stockQuantity": 200,
        "status": "ON_SALE",
        "matchScore": 0.82
      }
    ],
    "pageInfo": {
      "page": 1,
      "size": 20,
      "totalElements": 2,
      "totalPages": 1
    },
    "searchMeta": {
      "keyword": "설계",
      "field": "all",
      "elapsed": 45
    }
  }
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| data.items[].matchScore | Float | 검색 매칭 점수 (0.0~1.0) |
| data.searchMeta.keyword | String | 검색에 사용된 키워드 |
| data.searchMeta.field | String | 검색 대상 필드 |
| data.searchMeta.elapsed | Integer | 검색 소요 시간 (ms) |

> 참고: `matchScore`는 검색 엔진의 관련도 점수입니다. 기본적으로 `matchScore` 내림차순으로 정렬됩니다.

---

## 5. Webhook API

> 참고: Webhook은 BookStore 시스템에서 파트너 시스템으로 발송하는 비동기 알림입니다. 파트너는 Callback URL을 사전에 등록해야 합니다.

### 5.1 주문 알림

주문 접수 또는 주문 상태 변경 시 파트너 시스템으로 알림을 발송합니다.

#### 기본 정보

| 항목 | 내용 |
|------|------|
| 방향 | BookStore → 파트너 시스템 |
| 엔드포인트 | `POST /webhook/order` (파트너 제공) |
| 설명 | 주문 접수/상태 변경 알림 |
| 재시도 | 실패 시 최대 3회 (30초, 5분, 30분 간격) |

#### Webhook Payload

```json
{
  "eventType": "ORDER_CREATED",
  "eventId": "evt-20260115-001",
  "timestamp": "2026-01-15T14:30:00+09:00",
  "data": {
    "orderId": "ord-20260115-12345",
    "orderStatus": "CONFIRMED",
    "customerName": "박지민",
    "items": [
      {
        "bookId": "book-001",
        "isbn": "978-89-1234-567-8",
        "title": "클라우드 아키텍처 설계 패턴",
        "quantity": 2,
        "unitPrice": 28800,
        "subtotal": 57600
      }
    ],
    "totalAmount": 57600,
    "paymentMethod": "CARD",
    "shippingAddress": "서울특별시 강남구 테헤란로 123"
  }
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| eventType | String | 이벤트 유형 (`ORDER_CREATED`, `ORDER_SHIPPED`, `ORDER_DELIVERED`, `ORDER_CANCELLED`) |
| eventId | String | 이벤트 고유 ID (멱등성 보장용) |
| timestamp | String | 이벤트 발생 시각 |
| data.orderId | String | 주문 ID |
| data.orderStatus | String | 주문 상태 |
| data.customerName | String | 주문자명 |
| data.items[] | Array | 주문 상품 목록 |
| data.items[].bookId | String | 도서 ID |
| data.items[].quantity | Integer | 수량 |
| data.items[].unitPrice | Integer | 단가 (원) |
| data.items[].subtotal | Integer | 소계 (원) |
| data.totalAmount | Integer | 총 결제 금액 (원) |
| data.paymentMethod | String | 결제 수단 (`CARD`, `BANK_TRANSFER`, `POINT`) |
| data.shippingAddress | String | 배송지 |

#### 파트너 응답 규격

파트너 시스템은 Webhook 수신 시 아래 형식으로 응답해야 합니다.

```json
{
  "received": true,
  "eventId": "evt-20260115-001"
}
```

> 주의: 파트너 시스템이 200 OK를 반환하지 않으면 재시도가 수행됩니다. `eventId`를 기준으로 멱등성 처리를 구현하여 중복 처리를 방지하십시오.

### 5.2 재고 알림

도서의 재고가 임계값 이하로 감소하거나 소진되었을 때 파트너 시스템으로 알림을 발송합니다.

#### 기본 정보

| 항목 | 내용 |
|------|------|
| 방향 | BookStore → 파트너 시스템 |
| 엔드포인트 | `POST /webhook/inventory` (파트너 제공) |
| 설명 | 재고 부족/소진 알림 |
| 재시도 | 실패 시 최대 3회 (30초, 5분, 30분 간격) |

#### Webhook Payload

```json
{
  "eventType": "INVENTORY_LOW",
  "eventId": "evt-20260115-002",
  "timestamp": "2026-01-15T16:00:00+09:00",
  "data": {
    "bookId": "book-001",
    "isbn": "978-89-1234-567-8",
    "title": "클라우드 아키텍처 설계 패턴",
    "currentStock": 5,
    "threshold": 10,
    "alertLevel": "WARNING",
    "recommendedRestock": 100
  }
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| eventType | String | 이벤트 유형 (`INVENTORY_LOW`, `INVENTORY_OUT`) |
| data.bookId | String | 도서 ID |
| data.currentStock | Integer | 현재 재고 수량 |
| data.threshold | Integer | 알림 임계값 |
| data.alertLevel | String | 알림 등급 (`WARNING`: 임계값 이하, `CRITICAL`: 소진) |
| data.recommendedRestock | Integer | 권장 입고 수량 |

---

## 6. 연동 가이드

### 6.1 인증 토큰 발급 흐름

아래는 최초 인증부터 API 호출, 토큰 갱신까지의 전체 흐름을 설명합니다.

```
[파트너 시스템]                            [BookStore API Gateway]
      │                                           │
      │  ① POST /auth/token                       │
      │     {clientId, clientSecret}               │
      │ ─────────────────────────────────────────→ │
      │                                           │
      │  ② 200 OK                                 │
      │     {accessToken, expiresIn: 86400}        │
      │ ←───────────────────────────────────────── │
      │                                           │
      │  ③ GET /api/v1/books                       │
      │     Authorization: Bearer {accessToken}    │
      │ ─────────────────────────────────────────→ │
      │                                           │
      │  ④ 200 OK                                 │
      │     {code: "SUCCESS", data: {...}}         │
      │ ←───────────────────────────────────────── │
      │                                           │
      │        ... (24시간 경과, 토큰 만료) ...       │
      │                                           │
      │  ⑤ GET /api/v1/books                       │
      │     Authorization: Bearer {expired_token}  │
      │ ─────────────────────────────────────────→ │
      │                                           │
      │  ⑥ 401 Unauthorized                       │
      │     {code: "UNAUTHORIZED"}                 │
      │ ←───────────────────────────────────────── │
      │                                           │
      │  ⑦ POST /auth/token (재발급)               │
      │ ─────────────────────────────────────────→ │
      │                                           │
      │  ⑧ 200 OK (새 토큰 발급)                   │
      │ ←───────────────────────────────────────── │
```

> 참고: 토큰 만료 전에 미리 갱신하는 것을 권장합니다. `expiresIn` 값의 80% 시점(약 19시간)에 갱신하면 서비스 중단 없이 토큰을 교체할 수 있습니다.

### 6.2 에러 처리 가이드

#### 재시도 가능한 오류

| HTTP 상태 코드 | 권장 조치 | 재시도 전략 |
|---------------|----------|-----------|
| 429 | 요청 한도 초과 → 대기 후 재시도 | `Retry-After` 헤더 값만큼 대기 |
| 500 | 서버 내부 오류 → 재시도 | 지수 백오프 (1초, 2초, 4초), 최대 3회 |
| 502/503 | 일시적 서버 장애 → 재시도 | 지수 백오프 (1초, 2초, 4초), 최대 3회 |

#### 재시도 불가한 오류

| HTTP 상태 코드 | 권장 조치 |
|---------------|----------|
| 400 | 요청 파라미터 확인 후 수정하여 재요청 |
| 401 | 토큰 재발급 후 재요청 |
| 403 | 권한 확인 (ADMIN 역할 필요 여부) |
| 404 | 리소스 존재 여부 확인 |
| 409 | 중복 데이터 확인 후 조치 |

> 주의: 재시도 시 반드시 지수 백오프(Exponential Backoff)를 적용하십시오. 짧은 간격의 반복 재시도는 Rate Limiting에 의해 차단될 수 있습니다.

#### 에러 처리 예시 (의사 코드)

```python
def call_api_with_retry(request, max_retries=3):
    for attempt in range(max_retries + 1):
        response = http_client.send(request)

        if response.status == 200:
            return response.json()

        if response.status == 401:
            token = refresh_token()
            request.headers["Authorization"] = f"Bearer {token}"
            continue

        if response.status in [429, 500, 502, 503]:
            if attempt < max_retries:
                wait_time = (2 ** attempt)  # 1, 2, 4초
                time.sleep(wait_time)
                continue

        raise ApiError(response.status, response.json())
```

### 6.3 Rate Limiting

API 호출 한도는 클라이언트 등급에 따라 차등 적용됩니다.

| 등급 | 분당 요청 한도 | 일일 요청 한도 | 대상 |
|------|-------------|-------------|------|
| BASIC | 60회/분 | 10,000회/일 | 일반 파트너 |
| STANDARD | 300회/분 | 100,000회/일 | 계약 파트너 |
| PREMIUM | 1,000회/분 | 무제한 | 대형 파트너 |

한도 초과 시 `429 Too Many Requests`가 반환됩니다. 응답 헤더에 잔여 한도 정보가 포함됩니다.

| 헤더 | 설명 |
|------|------|
| X-RateLimit-Limit | 분당 최대 요청 수 |
| X-RateLimit-Remaining | 현재 분의 잔여 요청 수 |
| X-RateLimit-Reset | 한도 초기화 시각 (Unix timestamp) |
| Retry-After | 재시도까지 대기 시간 (초, 429 응답 시) |

> 참고: Rate Limiting은 클라이언트 ID 기준으로 적용됩니다. 여러 서버에서 동일 클라이언트 ID를 사용하는 경우, 전체 서버의 요청 합계가 한도에 적용됩니다.

> 주의: Rate Limit 한도 상향이 필요한 경우 API 운영팀에 사전 협의가 필요합니다. 등급 변경은 계약 조건에 따라 결정됩니다.
