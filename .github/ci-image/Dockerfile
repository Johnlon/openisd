# The browser job's test machine, saved (T752): the laptop's distribution and fonts, so screen pictures
# and row heights match the laptop baselines, plus Playwright's Chromium. Mirrors the apt steps that
# .github/workflows/suite.yml's browser job used to run on every shard. Built by ci-image.yml.
FROM ubuntu:26.04@sha256:6a06111c3b0a8600feadb270aec771dc239bf407b25625f93f44ab00e11f4d3c

SHELL ["/bin/bash", "-c"]
ARG PLAYWRIGHT_VERSION=1.61.0
ENV DEBIAN_FRONTEND=noninteractive \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# The laptop's packages (verbatim from the old browser job), plus node/npm to run the Playwright installer.
RUN apt-get update -qq \
 && apt-get install -y -qq git ca-certificates curl xz-utils fontconfig \
      fonts-dejavu-core fonts-dejavu-extra fonts-dejavu-mono fonts-droid-fallback fonts-font-awesome fonts-lato \
      fonts-liberation fonts-liberation-sans-narrow fonts-noto-mono fonts-ubuntu fonts-urw-base35 \
      nodejs npm > /dev/null

# Chromium and its system deps. This adds fonts the laptop lacks (one draws the glyph the laptop shows as a box).
RUN npx --yes playwright@${PLAYWRIGHT_VERSION} install --with-deps chromium

# Only the laptop's font packages stay.
RUN keep='fonts-dejavu-core fonts-dejavu-extra fonts-dejavu-mono fonts-droid-fallback fonts-font-awesome fonts-lato fonts-liberation fonts-liberation-sans-narrow fonts-noto-mono fonts-ubuntu fonts-urw-base35' \
 && extra=$(dpkg-query -W -f='${Package}\n' 'fonts-*' 'xfonts-*' 2>/dev/null | grep -vxF -f <(tr ' ' '\n' <<< "$keep") || true) \
 && echo "removing: $extra" \
 && { [ -z "$extra" ] || apt-get remove -y -qq $extra > /dev/null; } \
 && fc-cache -f > /dev/null \
 && rm -rf /var/lib/apt/lists/*

# The font list must equal the committed list; a difference fails the build and prints the real list.
COPY expected-fonts.txt /tmp/expected-fonts.txt
RUN fc-list : family file | sort > /tmp/actual-fonts.txt \
 && { diff -u /tmp/expected-fonts.txt /tmp/actual-fonts.txt \
      || { echo "FONT LIST MISMATCH; full actual list follows"; cat /tmp/actual-fonts.txt; exit 1; }; } \
 && rm /tmp/expected-fonts.txt /tmp/actual-fonts.txt
