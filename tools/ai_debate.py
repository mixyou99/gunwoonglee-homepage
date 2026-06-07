#!/usr/bin/env python3
"""
AI Debate: Claude vs ChatGPT 논문 검토 자동화 스크립트

두 AI가 서로의 피드백을 검토하고 수정안을 제시하는 멀티에이전트 시스템.
사용자는 최소한의 개입으로 두 AI의 토론 과정을 관찰할 수 있습니다.

사용법:
    python ai_debate.py --rounds 3 --task "논문 초안을 검토해줘"
    python ai_debate.py --rounds 3 --task "논문 초안을 검토해줘" --file paper.txt
"""

import argparse
import os
import sys
from datetime import datetime

from anthropic import Anthropic
from openai import OpenAI


def load_file(path: str) -> str:
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def call_chatgpt(client: OpenAI, messages: list[dict], model: str = "gpt-4o") -> str:
    response = client.chat.completions.create(
        model=model,
        messages=messages,
        temperature=0.7,
    )
    return response.choices[0].message.content


def call_claude(client: Anthropic, messages: list[dict], system: str = "", model: str = "claude-sonnet-4-20250514") -> str:
    response = client.messages.create(
        model=model,
        max_tokens=4096,
        system=system,
        messages=messages,
    )
    return response.content[0].text


def print_divider(label: str):
    width = 60
    print(f"\n{'='*width}")
    print(f"  {label}")
    print(f"{'='*width}\n")


def run_debate(task: str, content: str, rounds: int, output_file: str | None):
    # API 클라이언트 초기화
    openai_key = os.environ.get("OPENAI_API_KEY")
    anthropic_key = os.environ.get("ANTHROPIC_API_KEY")

    if not openai_key:
        print("Error: OPENAI_API_KEY 환경변수를 설정해주세요.")
        print("  export OPENAI_API_KEY='sk-...'")
        sys.exit(1)
    if not anthropic_key:
        print("Error: ANTHROPIC_API_KEY 환경변수를 설정해주세요.")
        print("  export ANTHROPIC_API_KEY='sk-ant-...'")
        sys.exit(1)

    openai_client = OpenAI(api_key=openai_key)
    anthropic_client = Anthropic(api_key=anthropic_key)

    # 로그 저장용
    full_log = []

    def log(role: str, text: str):
        full_log.append(f"[{role}]\n{text}\n")
        print(text)

    # 초기 프롬프트 구성
    user_input = f"## 작업 요청\n{task}"
    if content:
        user_input += f"\n\n## 원본 내용\n{content}"

    print_divider("AI 토론 시작")
    print(f"작업: {task}")
    print(f"라운드: {rounds}회")
    print(f"시작 시간: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    # ── 시스템 프롬프트 ──
    claude_system = (
        "당신은 학술 논문 검토 전문가(Claude)입니다. "
        "다른 AI(ChatGPT)와 함께 논문을 검토하고 있습니다. "
        "ChatGPT의 의견에 동의하는 부분과 다른 시각을 제시할 부분을 구분하여 답변하세요. "
        "구체적이고 건설적인 피드백을 제공하세요. "
        "한국어로 답변하세요."
    )

    chatgpt_system = {
        "role": "system",
        "content": (
            "당신은 학술 논문 검토 전문가(ChatGPT)입니다. "
            "다른 AI(Claude)와 함께 논문을 검토하고 있습니다. "
            "Claude의 의견에 동의하는 부분과 다른 시각을 제시할 부분을 구분하여 답변하세요. "
            "구체적이고 건설적인 피드백을 제공하세요. "
            "한국어로 답변하세요."
        ),
    }

    # ── 라운드 1: Claude가 먼저 검토 ──
    print_divider("Round 1 - Claude 초기 검토")

    claude_messages = [{"role": "user", "content": user_input}]
    claude_response = call_claude(anthropic_client, claude_messages, system=claude_system)
    claude_messages.append({"role": "assistant", "content": claude_response})
    log("Claude (Round 1)", claude_response)

    # ChatGPT에게 Claude의 검토를 전달
    print_divider("Round 1 - ChatGPT 검토 및 반론")

    chatgpt_messages = [
        chatgpt_system,
        {
            "role": "user",
            "content": (
                f"{user_input}\n\n"
                f"---\n\n"
                f"## Claude의 검토 의견\n{claude_response}\n\n"
                f"위 원본 내용과 Claude의 검토를 바탕으로, "
                f"당신의 검토 의견을 제시해주세요. "
                f"Claude의 의견에 동의/반박할 부분을 명확히 구분해주세요."
            ),
        },
    ]
    chatgpt_response = call_chatgpt(openai_client, chatgpt_messages)
    chatgpt_messages.append({"role": "assistant", "content": chatgpt_response})
    log("ChatGPT (Round 1)", chatgpt_response)

    # ── 이후 라운드: 서로 검토 반복 ──
    for round_num in range(2, rounds + 1):
        # Claude가 ChatGPT의 피드백을 검토
        print_divider(f"Round {round_num} - Claude 재검토")

        claude_messages.append({
            "role": "user",
            "content": (
                f"## ChatGPT의 검토 의견 (Round {round_num - 1})\n{chatgpt_response}\n\n"
                f"ChatGPT의 위 의견을 검토하고, 합의점과 추가 수정이 필요한 부분을 정리해주세요."
            ),
        })
        claude_response = call_claude(anthropic_client, claude_messages, system=claude_system)
        claude_messages.append({"role": "assistant", "content": claude_response})
        log(f"Claude (Round {round_num})", claude_response)

        # ChatGPT가 Claude의 피드백을 검토
        print_divider(f"Round {round_num} - ChatGPT 재검토")

        chatgpt_messages.append({
            "role": "user",
            "content": (
                f"## Claude의 검토 의견 (Round {round_num})\n{claude_response}\n\n"
                f"Claude의 위 의견을 검토하고, 합의점과 추가 수정이 필요한 부분을 정리해주세요."
            ),
        })
        chatgpt_response = call_chatgpt(openai_client, chatgpt_messages)
        chatgpt_messages.append({"role": "assistant", "content": chatgpt_response})
        log(f"ChatGPT (Round {round_num})", chatgpt_response)

    # ── 최종 요약: Claude가 합의안 작성 ──
    print_divider("최종 합의안 작성 (Claude)")

    claude_messages.append({
        "role": "user",
        "content": (
            "지금까지의 토론을 바탕으로 최종 합의안을 작성해주세요.\n\n"
            "다음 형식으로 정리해주세요:\n"
            "1. **합의된 수정 사항** - 두 AI가 동의한 수정 포인트\n"
            "2. **의견이 갈리는 부분** - 각자의 입장 요약\n"
            "3. **최종 수정 제안** - 구체적인 수정 내용\n"
            "4. **추가 검토 필요 사항** - 저자가 직접 판단해야 할 부분"
        ),
    })
    final_summary = call_claude(anthropic_client, claude_messages, system=claude_system)
    log("최종 합의안", final_summary)

    # ── 결과 저장 ──
    if output_file:
        with open(output_file, "w", encoding="utf-8") as f:
            f.write(f"# AI 논문 검토 토론 결과\n")
            f.write(f"날짜: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"작업: {task}\n")
            f.write(f"라운드: {rounds}\n\n")
            f.write("---\n\n".join(full_log))
        print(f"\n결과가 {output_file}에 저장되었습니다.")

    print_divider("토론 완료")


def main():
    parser = argparse.ArgumentParser(description="Claude vs ChatGPT 논문 검토 토론")
    parser.add_argument("--task", required=True, help="검토 작업 설명 (예: '논문 초안을 검토해줘')")
    parser.add_argument("--file", help="검토할 파일 경로 (txt, md 등)")
    parser.add_argument("--rounds", type=int, default=3, help="토론 라운드 수 (기본: 3)")
    parser.add_argument("--output", help="결과 저장 파일 경로 (예: result.md)")

    args = parser.parse_args()

    content = ""
    if args.file:
        if not os.path.exists(args.file):
            print(f"Error: 파일을 찾을 수 없습니다: {args.file}")
            sys.exit(1)
        content = load_file(args.file)
        print(f"파일 로드 완료: {args.file} ({len(content)}자)")

    run_debate(
        task=args.task,
        content=content,
        rounds=args.rounds,
        output_file=args.output,
    )


if __name__ == "__main__":
    main()
