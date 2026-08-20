FROM node:22-bookworm@sha256:0557ac14e0d45d02ed563067b82856ca5e7aa3437fa28d98d4350ea9c3d9494a

ARG OPENMONTAGE_REF=1bab711820828c2e5fc1f87ed274a32587cb048f
ARG CODEX_NPM_SPEC=@openai/codex@0.148.0

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
    && (/opt/openmontage/.venv/bin/python -m pip install piper-tts \
      || echo '[openmontage] Piper install unavailable; cloud TTS remains usable')

RUN cd /opt/openmontage/remotion-composer \
    && if [ -f package-lock.json ]; then npm ci; else npm install; fi

# Match upstream `make setup`: warm HyperFrames when npm can resolve it, but do
# not make a temporary npm outage prevent the entire executor image from building.
RUN cd /opt/openmontage \
    && (npx --yes hyperframes --version >/dev/null 2>&1 \
      || echo '[openmontage] HyperFrames cache warm skipped; it can resolve at runtime')

# Codex is the default headless driver. Pin the version that passed ORKY's image
# smoke tests; override CODEX_NPM_SPEC deliberately when upgrading it.
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
