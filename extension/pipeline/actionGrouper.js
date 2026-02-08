(() => {
  function groupByActions(normalizedEvents, config) {
    const safeConfig = config || {};
    const windowConfig = safeConfig.actionWindowMs || { pre: 0, post: 0 };
    const preMs = typeof windowConfig.pre === "number" ? windowConfig.pre : 0;
    const postMs = typeof windowConfig.post === "number" ? windowConfig.post : 0;
    const events = Array.isArray(normalizedEvents) ? normalizedEvents : [];

    const actionEvents = events.filter(
      (event) => event.kind === "action" || event.kind === "marker"
    );

    const actions = actionEvents
      .map((event, index) => {
        const actionId = `act_${String(index + 1).padStart(4, "0")}`;
        const tMs = typeof event.t_ms === "number" ? event.t_ms : 0;
        return {
          actionId,
          t_ms: tMs,
          ts_iso: event.ts_iso,
          kind: event.kind,
          msg: event.msg || "",
          windowStart: tMs - preMs,
          windowEnd: tMs + postMs,
        };
      })
      .sort((a, b) => (a.t_ms !== b.t_ms ? a.t_ms - b.t_ms : 0));

    const actionsById = new Map(actions.map((action) => [action.actionId, action]));
    const actionIdByEventId = new Map();
    actionEvents.forEach((event, index) => {
      const actionId = `act_${String(index + 1).padStart(4, "0")}`;
      if (event.id) {
        actionIdByEventId.set(event.id, actionId);
      }
    });

    const normalizedEventsWithActionIds = events.map((event) => {
      if (!actions.length) {
        return event;
      }
      if (event.kind === "action" || event.kind === "marker") {
        const mappedActionId = actionIdByEventId.get(event.id);
        if (mappedActionId) {
          return {
            ...event,
            corr: { ...event.corr, actionId: mappedActionId },
          };
        }
      }

      const candidates = [];
      for (const action of actions) {
        if (event.t_ms >= action.windowStart && event.t_ms <= action.windowEnd) {
          const distance = Math.abs(event.t_ms - action.t_ms);
          candidates.push({ action, distance });
        }
      }
      if (candidates.length === 0) {
        return event;
      }
      candidates.sort((a, b) => {
        if (a.distance !== b.distance) {
          return a.distance - b.distance;
        }
        return b.action.t_ms - a.action.t_ms;
      });
      const chosen = candidates[0].action;
      if (!actionsById.has(chosen.actionId)) {
        return event;
      }
      return {
        ...event,
        corr: { ...event.corr, actionId: chosen.actionId },
      };
    });

    return { actions, normalizedEventsWithActionIds };
  }

  self.PipelineActionGrouper = { groupByActions };
})();
