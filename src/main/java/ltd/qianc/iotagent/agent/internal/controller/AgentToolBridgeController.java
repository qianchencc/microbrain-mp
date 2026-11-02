package ltd.qianc.iotagent.conversation.internal.controller;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import ltd.qianc.iotagent.action.ActionDraftFacade;
import ltd.qianc.iotagent.auth.PrincipalInfo;
import ltd.qianc.iotagent.conversation.ConversationFacade;
import ltd.qianc.iotagent.error.BusinessException;
import ltd.qianc.iotagent.iot.DeviceCandidateQuery;
import ltd.qianc.iotagent.iot.DeviceCapabilityRequest;
import ltd.qianc.iotagent.iot.IotAdapter;
import ltd.qianc.iotagent.iot.IotSource;
import ltd.qianc.iotagent.iot.RequestIdentity;
import ltd.qianc.iotagent.task.TaskFacade;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Authenticated internal bridge from the Node Pi sidecar back into Java tools. */
@RestController
@RequestMapping("/internal/agent/tools")
public final class AgentToolBridgeController {
    private static final Duration TIMEOUT = Duration.ofSeconds(30);
    private final ConversationFacade conversations;
    private final IotAdapter iot;
    private final ActionDraftFacade actions;
    private final TaskFacade tasks;
    private final ObjectMapper mapper;

    public AgentToolBridgeController(ConversationFacade conversations, IotAdapter iot,
            ActionDraftFacade actions, TaskFacade tasks, ObjectMapper mapper) {
        this.conversations = conversations;
        this.iot = iot;
        this.actions = actions;
        this.tasks = tasks;
        this.mapper = mapper;
    }

    @PostMapping
    public Map<String, Object> execute(@RequestBody(required = false) Map<String, Object> body) {
        if (body == null) throw new BusinessException("INVALID_AGENT_TOOL", "工具请求不能为空");
        String toolContextId = text(body, "toolContextId", "");
        String conversationId = text(body, "conversationId", "");
        String turnId = text(body, "turnId", "");
        String toolName = text(body, "toolName", "");
        PrincipalInfo principal = conversations.toolPrincipal(toolContextId, conversationId, turnId);
        Map<String, Object> arguments = map(body.get("arguments"));
        return switch (toolName) {
            case "find_device_candidates" -> findCandidates(principal, source(arguments), arguments);
            case "read_device_states" -> readStates(principal, source(arguments), arguments);
            case "inspect_device_capabilities" -> inspectCapabilities(principal, source(arguments), arguments);
            case "propose_action_draft" -> proposeAction(principal, conversationId, turnId, arguments);
            case "propose_task" -> proposeTask(principal, conversationId, turnId, arguments);
            default -> throw new BusinessException("AGENT_TOOL_UNAVAILABLE", "工具未接入", 404);
        };
    }

    private Map<String, Object> findCandidates(PrincipalInfo principal, IotSource source, Map<String, Object> args) {
        DeviceCandidateQuery query = new DeviceCandidateQuery(text(args, "kind", "unknown"), strings(args.get("deviceIds")),
                nullableText(args, "scopeText"), strings(args.get("scopeTerms")), strings(args.get("nameHints")), nullableText(args, "deviceText"));
        return mapper.convertValue(iot.findDeviceCandidates(identity(principal, source), query).block(TIMEOUT), Map.class);
    }

    private Map<String, Object> readStates(PrincipalInfo principal, IotSource source, Map<String, Object> args) {
        return mapper.convertValue(iot.readDeviceStates(identity(principal, source), strings(args.get("deviceIds"))).block(TIMEOUT), Map.class);
    }

    private Map<String, Object> inspectCapabilities(PrincipalInfo principal, IotSource source, Map<String, Object> args) {
        List<DeviceCapabilityRequest.DeviceCapabilitySelection> selections = new ArrayList<>();
        for (Object value : list(args.get("candidateSets"))) {
            Map<String, Object> item = map(value);
            selections.add(new DeviceCapabilityRequest.DeviceCapabilitySelection(text(item, "candidateSetId", ""), strings(item.get("deviceIds"))));
        }
        return mapper.convertValue(iot.inspectDeviceCapabilities(identity(principal, source), new DeviceCapabilityRequest(selections)).block(TIMEOUT), Map.class);
    }

    private Map<String, Object> proposeAction(PrincipalInfo principal, String conversationId, String turnId, Map<String, Object> args) {
        try {
            return actions.view(actions.propose(principal, text(args, "source", "office"), conversationId, turnId,
                    mapper.writeValueAsString(map(args.get("payload"))), text(args, "idempotencyKey", "")));
        } catch (JsonProcessingException error) {
            throw new BusinessException("INVALID_ACTION_DRAFT", "草案内容无效");
        }
    }

    private Map<String, Object> proposeTask(PrincipalInfo principal, String conversationId, String turnId, Map<String, Object> args) {
        try {
            return tasks.proposalView(tasks.propose(principal, text(args, "source", "office"), conversationId, turnId,
                    mapper.writeValueAsString(map(args.get("payload"))), text(args, "idempotencyKey", "")));
        } catch (JsonProcessingException error) {
            throw new BusinessException("INVALID_TASK_PAYLOAD", "任务内容无效");
        }
    }

    private static RequestIdentity identity(PrincipalInfo principal, IotSource source) {
        return new RequestIdentity(principal.authorization(), principal.tenantCode(), source);
    }

    private static IotSource source(Map<String, Object> args) { return IotSource.parse(text(args, "source", "office")); }

    private static String text(Map<String, Object> body, String key, String fallback) {
        Object value = body.get(key);
        return value instanceof String text && !text.isBlank() ? text : fallback;
    }

    private static String nullableText(Map<String, Object> body, String key) {
        Object value = body.get(key);
        return value instanceof String text && !text.isBlank() ? text : null;
    }

    private static List<String> strings(Object value) {
        List<String> result = new ArrayList<>();
        for (Object item : list(value)) if (item instanceof String text && !text.isBlank()) result.add(text);
        return result;
    }

    private static List<?> list(Object value) { return value instanceof List<?> values ? values : List.of(); }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> map(Object value) {
        if (!(value instanceof Map<?, ?> raw)) throw new BusinessException("INVALID_AGENT_TOOL", "工具参数格式无效");
        return (Map<String, Object>) (Map<?, ?>) raw;
    }
}
