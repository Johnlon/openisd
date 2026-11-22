#!/usr/bin/env bash
# Exit 0 only where baseline pictures may be drawn: the visual-retake workflow's test machine (T799). Every other
# machine, whatever its fonts, draws pictures the suite's browser job will not match (T791 did, 37 screens red on main).
#   . scripts/visual/can-draw.sh      defines visual_can_draw
visual_can_draw() { [ "${OPENISD_VISUAL_DRAWER:-}" = ci-runner ] && [ "${GITHUB_ACTIONS:-}" = true ]; }
if [ "${BASH_SOURCE[0]}" = "$0" ]; then visual_can_draw; fi
