import { useState, useEffect } from "react";
import { apiGet } from "@/lib/api";
export type AIIntentNotification = {
    id: string;
    contact_name: string;
    contact_phone: string;
    original_message: string;
    detected_intent: "CONFIRM_APPOINTMENT" | "CANCEL_APPOINTMENT" | "PRICING_QUESTION" | "RESCHEDULE_REQUEST" | "UNKNOWN";
    suggested_action: string;
    extracted_date?: string;
    confidence: number;
    timestamp: string;
};

// In a real application, this would establish a WebSocket connection to the Python API
// which acts as the orchestrator between Baileys (WhatsApp) and Ollama (Local AI).
// For the L2 CORE OS v1 prototype/showcase, we will mock incoming AI intents
// to demonstrate the "Motor" capabilities.
export function useAIIntent() {
    const [notifications, setNotifications] = useState<AIIntentNotification[]>([]);

    useEffect(() => {
        let mounted = true;

        async function fetchRealIntents() {
            try {
                // We fetch the human review queue, which acts as the real "L2 Motor" pending items
                const res = await apiGet<any>('/human-review/list');
                if (!mounted) return;

                const queue = res.items || [];
                const mapped: AIIntentNotification[] = queue.map((item: any, i: number) => ({
                    id: `nt-${item.id || i}`,
                    contact_name: (item.source || "Desconhecido").replace('whatsapp_', '+'), // Format source phone
                    contact_phone: item.reference_id || "Desconhecido",
                    original_message: item.text || item.reason || "Mensagem capturada",
                    detected_intent: "UNKNOWN",
                    suggested_action: "Analisar e Responder Manualmente",
                    confidence: 1.0,
                    timestamp: item.created_at || new Date().toISOString()
                }));

                setNotifications(mapped.slice(0, 5)); // Show top 5 pending
            } catch (e) {
                console.error("Failed to fetch L2 Motor tasks", e);
            }
        }

        fetchRealIntents();
        // optionally poll every 30s
        const interval = setInterval(fetchRealIntents, 30000);

        return () => {
            mounted = false;
            clearInterval(interval);
        };
    }, []);

    const dismissNotification = (id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    };

    const executeAction = async (notification: AIIntentNotification) => {
        // Just dismiss for now in the prototype
        console.log("Executing Action for", notification.detected_intent);
        dismissNotification(notification.id);
    };

    return {
        notifications,
        dismissNotification,
        executeAction,
        activeMotor: true // In real app, derived from Ollama health check
    };
}
