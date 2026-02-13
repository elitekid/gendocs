#!/usr/bin/env python3
"""
=============================================================================
시퀀스 다이어그램 템플릿
=============================================================================

사용법:
1. 이 파일을 복사하여 새 다이어그램 생성
2. ENTITIES, 제목, Step 내용 수정
3. python3 diagram_template.py 실행

수정 포인트:
- FIG_HEIGHT: 다이어그램 높이 (Step 개수에 따라 조정)
- ENTITY_Y: 엔티티 박스 Y 위치
- ENTITIES: 참여 시스템 정의
- 제목/부제목 텍스트
- Step 내용 (draw_step_badge, draw_step_description, draw_arrow 등)

색상 코드:
- Client: #0066B3 (파란색)
- Gateway: #4EC9B0 (민트색)
- Backend: #E97132 (주황색)
- External: #D85A2A (진한 주황색)
- 기타: #666666 (회색)
"""
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as patches
from matplotlib import font_manager

# =============================================================================
# 폰트 설정
# =============================================================================
font_path = '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'
font_prop = font_manager.FontProperties(fname=font_path)
font_prop_bold = font_manager.FontProperties(fname=font_path, weight='bold')

# =============================================================================
# 색상 팔레트
# =============================================================================
COLORS = {
    'primary': '#1F4E79',      # 제목 색상
    'client': '#0066B3',       # 클라이언트
    'gateway': '#4EC9B0',      # 게이트웨이
    'backend': '#E97132',      # 백엔드 서비스
    'external': '#D85A2A',     # 외부 시스템
    'gray': '#666666',         # 기타 엔티티
    'light_gray': '#F2F2F2',
    'line': '#AAAAAA',         # 라이프라인
    'text': '#333333',         # 텍스트
    'white': '#FFFFFF',
    'note_bg': '#FFFDE7',      # 노트 배경
    'note_border': '#FBC02D',  # 노트 테두리
    'step_bg1': '#E8EEF4',     # Step 배경 (홀수)
    'step_bg2': '#F5F5F5',     # Step 배경 (짝수)
}

# =============================================================================
# 설정값 (다이어그램마다 조정 필요)
# =============================================================================
FIG_WIDTH = 14               # 그림 너비
FIG_HEIGHT = 15              # 그림 높이 (Step 개수에 따라 조정)
ENTITY_Y = 13.0              # 엔티티 박스 Y 위치
LIFELINE_BOTTOM = 1.3        # 라이프라인 하단 Y 위치

# =============================================================================
# 엔티티 정의 (다이어그램마다 수정 필요)
# =============================================================================
ENTITIES = {
    'Client': {'x': 2.5, 'color': COLORS['client'], 'label': 'Client App'},
    'Gateway': {'x': 5.5, 'color': COLORS['gateway'], 'label': 'API Gateway'},
    'Backend': {'x': 8.5, 'color': COLORS['backend'], 'label': 'Backend Service'},
    'External': {'x': 11.5, 'color': COLORS['external'], 'label': 'External API'},
}

# =============================================================================
# Figure 생성
# =============================================================================
fig, ax = plt.subplots(figsize=(FIG_WIDTH, FIG_HEIGHT))
ax.set_xlim(0, FIG_WIDTH)
ax.set_ylim(0, FIG_HEIGHT)
ax.axis('off')
ax.set_facecolor('white')

# =============================================================================
# 헬퍼 함수들
# =============================================================================
def draw_entity_box(name, x, color, label):
    """엔티티 박스 그리기"""
    width, height = 2.8, 0.8
    rect = patches.FancyBboxPatch(
        (x - width/2, ENTITY_Y - height/2),
        width, height,
        boxstyle="round,pad=0.02,rounding_size=0.1",
        facecolor=color, edgecolor='none', zorder=10
    )
    ax.add_patch(rect)
    ax.text(x, ENTITY_Y, label,
            ha='center', va='center', fontsize=14, fontproperties=font_prop_bold,
            color='white', zorder=11)

def draw_lifeline(x):
    """라이프라인 점선 그리기"""
    ax.plot([x, x], [ENTITY_Y - 0.4, LIFELINE_BOTTOM],
            color=COLORS['line'], linestyle='--', linewidth=1, zorder=1)

def draw_arrow(from_x, to_x, y, label="", is_response=False):
    """화살표 그리기 (요청: 실선, 응답: 점선)"""
    style = 'dashed' if is_response else 'solid'
    color = COLORS['gray'] if is_response else COLORS['text']

    ax.annotate('',
                xy=(to_x, y), xytext=(from_x, y),
                arrowprops=dict(
                    arrowstyle='-|>',
                    color=color,
                    lw=1.5,
                    linestyle=style,
                    mutation_scale=15
                ),
                zorder=5)

    if label:
        mid_x = (from_x + to_x) / 2
        ax.text(mid_x, y + 0.15, label,
                ha='center', va='bottom', fontsize=13, fontproperties=font_prop,
                color=COLORS['text'], zorder=6)

def draw_step_badge(y, text, is_pre=False):
    """Step 배지 그리기"""
    x = 0.9
    width = 1.2 if is_pre else 1.4
    height = 0.5
    color = COLORS['gray'] if is_pre else COLORS['primary']

    rect = patches.FancyBboxPatch(
        (x - width/2, y - height/2),
        width, height,
        boxstyle="round,pad=0.02,rounding_size=0.08",
        facecolor=color, edgecolor='none', zorder=10
    )
    ax.add_patch(rect)
    ax.text(x, y, text,
            ha='center', va='center', fontsize=13, fontproperties=font_prop_bold,
            color='white', zorder=11)

def draw_step_area(y_top, y_bottom, is_odd=True):
    """Step 영역 배경 그리기"""
    color = COLORS['step_bg1'] if is_odd else COLORS['step_bg2']
    rect = patches.Rectangle(
        (0.2, y_bottom - 0.1),
        FIG_WIDTH - 0.4, y_top - y_bottom + 0.3,
        facecolor=color, edgecolor='none', zorder=0
    )
    ax.add_patch(rect)

def draw_note(x, y, text, width=3.2):
    """노트 박스 그리기"""
    height = 0.55
    ax.plot([x, x], [y + height/2 + 0.2, y + height/2],
            color=COLORS['note_border'], linewidth=2, zorder=7)

    rect = patches.FancyBboxPatch(
        (x - width/2, y - height/2),
        width, height,
        boxstyle="round,pad=0.03,rounding_size=0.08",
        facecolor=COLORS['note_bg'], edgecolor=COLORS['note_border'],
        linewidth=2, zorder=8
    )
    ax.add_patch(rect)
    ax.text(x, y, text,
            ha='center', va='center', fontsize=13, fontproperties=font_prop,
            color=COLORS['text'], zorder=9)

def draw_step_description(y, text):
    """Step 설명 텍스트"""
    ax.text(1.8, y, text,
            ha='left', va='center', fontsize=14, fontproperties=font_prop,
            color=COLORS['text'])

def draw_legend():
    """범례 박스 그리기"""
    legend_x, legend_y = 9.0, 0.5
    box_width, box_height = 4.5, 0.5

    rect = patches.FancyBboxPatch(
        (legend_x - 0.3, legend_y - box_height/2),
        box_width, box_height,
        boxstyle="round,pad=0.02,rounding_size=0.05",
        facecolor=COLORS['white'], edgecolor=COLORS['line'],
        linewidth=1, zorder=10
    )
    ax.add_patch(rect)

    # 요청 범례
    ax.plot([legend_x, legend_x + 0.6], [legend_y, legend_y],
            color=COLORS['text'], linewidth=1.5, linestyle='solid', zorder=11)
    ax.annotate('', xy=(legend_x + 0.6, legend_y), xytext=(legend_x + 0.45, legend_y),
                arrowprops=dict(arrowstyle='-|>', color=COLORS['text'], lw=1.2, mutation_scale=10), zorder=11)
    ax.text(legend_x + 0.8, legend_y, '요청', ha='left', va='center',
            fontsize=14, fontproperties=font_prop, zorder=11)

    # 응답 범례
    ax.plot([legend_x + 1.8, legend_x + 2.4], [legend_y, legend_y],
            color=COLORS['gray'], linewidth=1.5, linestyle='dashed', zorder=11)
    ax.annotate('', xy=(legend_x + 2.4, legend_y), xytext=(legend_x + 2.25, legend_y),
                arrowprops=dict(arrowstyle='-|>', color=COLORS['gray'], lw=1.2, linestyle='dashed', mutation_scale=10), zorder=11)
    ax.text(legend_x + 2.6, legend_y, '응답', ha='left', va='center',
            fontsize=14, fontproperties=font_prop, zorder=11)

# =============================================================================
# 다이어그램 그리기 시작
# =============================================================================

# 제목 (수정 필요)
ax.text(FIG_WIDTH/2, FIG_HEIGHT - 0.5, '다이어그램 제목',
        ha='center', va='top', fontsize=20, fontproperties=font_prop_bold,
        color=COLORS['primary'])
ax.text(FIG_WIDTH/2, FIG_HEIGHT - 1.2, '부제목 설명',
        ha='center', va='top', fontsize=15, fontproperties=font_prop,
        color=COLORS['gray'])

# 엔티티 박스 & 라이프라인 그리기
for name, info in ENTITIES.items():
    draw_entity_box(name, info['x'], info['color'], info['label'])
    draw_lifeline(info['x'])

# Y 좌표 시작점
y = 11.5

# =============================================================================
# Step 정의 (아래 패턴을 복사하여 Step 추가)
# =============================================================================

# === 사전 단계 예시 ===
step_start = y + 0.3
draw_step_badge(y, '사전', is_pre=True)
draw_step_description(y, '인증 토큰 발급')

y -= 0.6
draw_arrow(ENTITIES['Client']['x'], ENTITIES['Gateway']['x'], y, 'POST /auth/token')
y -= 0.45
draw_arrow(ENTITIES['Gateway']['x'], ENTITIES['Backend']['x'], y, '토큰 검증')
y -= 0.45
draw_arrow(ENTITIES['Backend']['x'], ENTITIES['Gateway']['x'], y, '토큰 응답', is_response=True)
y -= 0.45
draw_arrow(ENTITIES['Gateway']['x'], ENTITIES['Client']['x'], y, 'Response (token)', is_response=True)
step_end = y - 0.2
draw_step_area(step_start, step_end, is_odd=False)

y -= 0.7

# === Step 1 예시 ===
step_start = y + 0.3
draw_step_badge(y, 'Step 1')
draw_step_description(y, 'API 요청 처리')

y -= 0.6
draw_arrow(ENTITIES['Client']['x'], ENTITIES['Gateway']['x'], y, 'API 호출')
y -= 0.45
draw_arrow(ENTITIES['Gateway']['x'], ENTITIES['Backend']['x'], y, '요청')
y -= 0.45
draw_arrow(ENTITIES['Backend']['x'], ENTITIES['Gateway']['x'], y, '응답', is_response=True)
y -= 0.45
draw_arrow(ENTITIES['Gateway']['x'], ENTITIES['Client']['x'], y, 'Response', is_response=True)
step_end = y - 0.2
draw_step_area(step_start, step_end, is_odd=True)

# 노트 추가 예시 (필요 시)
# y -= 0.55
# draw_note(ENTITIES['Backend']['x'], y, '노트 내용', width=2.5)

# =============================================================================
# 범례 & 저장
# =============================================================================
draw_legend()

plt.tight_layout()
fig.savefig('/home/claude/output_diagram.png', dpi=150, bbox_inches='tight',
            facecolor='white', edgecolor='none')
plt.close(fig)
print("Created: output_diagram.png")
