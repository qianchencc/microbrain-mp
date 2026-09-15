# Native Single-Device Execution

Verified 2026-09-07 via the native mini-program textarea and confirmation button.

- Running runtime PID 9922 had IOT_BASE_URL=http://127.0.0.1:3100 and IOT_STATE_SOURCE=simulation. Port 3100 PID 45791 cwd was ../Iotfake; healthz identified iotfake. No physical devices were addressed.
- Initial request for an already-satisfied 26C setting correctly produced an ordinary answer without a pending draft.
- Requested only meeting-room AC temperature 27C, retaining other parameters.
- Draft f10f2d1e-c195-478b-8218-1b35f82671c7 contained one selected AC, device 050645048a4c624257bfb78074d898df, command {temperature:27}, before temperature 26C.
- Native confirmation produced exactly one new mock operation: 1ca3759f-05e5-49d8-aa52-05aa7202078a, AC_TEMPERATURE 270, accepted at 2026-09-07T11:13:00.718Z.
- Persisted result ACCEPTED, temperature field ACCEPTED, summary completed.
- Native accessibility tree showed read-only result card, 26C -> 27C, 已达到目标, simulated source timestamp, and the ordinary final answer below it.
- Final answer: 26楼会议室空调的设定温度调整指令已受理，目标为27℃；回执未提供设备当前实际温度。
- Native reLaunch restored the result, current simulated state and final answer. Mock operations since draft creation still contained exactly the same single operation, proving this refresh did not resend controls. Screenshot: execution-complete.png.

This test changed the local mock AC temperature from 26C to 27C. It did not reset mock data, clear history, or execute a batch. It does not prove physical device effects or physical-phone input behavior.
