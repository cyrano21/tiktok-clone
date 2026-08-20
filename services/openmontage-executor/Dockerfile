FROM node:22-bookworm

ARG OPENMONTAGE_REF=1bab711820828c2e5fc1f87ed274a32587cb048f
ARG CODEX_NPM_SPEC=@openai/codex@latest

ENV DEBIAN_FRONTEND=noninteractive \
    OPENMONTAGE_ROOT=/opt/openmontage \
    OPENMONTAGE_EXECUTOR_DATA=/data/openmontage-executor \
    PATH=/opt/openmontage/.venv/bin:$PATH \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
      ca-certificates \
      curl \
      ffmpeg \
      git \
      make \
      python3 \
      python3-pip \
      python3-venv \
    && rm -rf /var/lib/apt/lists/*

# Pin the upstream source so an ORKY deploy cannot silently change its production
# behavior just because OpenMontage/main moved.
RUN git clone https://github.com/calesthio/OpenMontage.git /opt/openmontage \
    && cd /opt/openmontage \
    && git checkout "$OPENMONTAGE_REF" \
    && test "$(git rev-parse HEAD)" = "$OPENMONTAGE_REF"

RUN python3 -m venv /opt/openmontage/.venv \
    && /opt/openmontage/.venv/bin/python -m pip install --upgrade pip wheel setuptools \
    && /opt/openmontage/.venv/bin/python -m pip install -r /opt/openmontage/requirements.txt \
    && /opt/openmontage/.venv/bin/python -m pip install piper-tts

RUN cd /opt/openmontage/remotion-composer \
    && if [ -f package-lock.json ]; then npm ci; else npm install; fi

# Codex is the default headless driver. The executor can run any other agent by
# setting OPENMONTAGE_AGENT_COMMAND_JSON, so this does not lock the bridge to one
# model/provider.
RUN npm install -g "$CODEX_NPM_SPEC"

WORKDIR /opt/orky-openmontage-executor
COPY server.py ./server.py

RUN mkdir -p /data/openmontage-executor \
    && useradd --create-home --uid 10001 executor \
    && chown -R executor:executor /data/openmontage-executor /opt/openmontage /opt/orky-openmontage-executor

USER executor
EXPOSE 8787

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD curl -fsS http://127.0.0.1:8787/health || exit 1

CMD ["python3", "/opt/orky-openmontage-executor/server.py"]
