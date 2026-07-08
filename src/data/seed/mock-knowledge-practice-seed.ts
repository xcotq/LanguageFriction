import type { SQLiteDatabase } from "expo-sqlite";

import { PracticeDao } from "@/data/dao/learning.dao";
import type { InquiryExtractionDraft } from "@/data/repositories/knowledge.repository";
import type {
    LearningTargetDraft,
    PracticeItemDraft,
    PracticeResponseDraft,
} from "@/data/repositories/practice.repository";
import { getLanguageFrictionRepositories } from "@/data/repositories/registry";

const SEED_USER_ID = "mock-user";

function seedDate(value: string) {
    return new Date(value);
}

const seedInquiryExtractions: InquiryExtractionDraft[] = [
    {
        inquiry: {
            id: "inquiry:seed:restaurant-extra-bacon-bits",
            sessionId: "session-current",
            title: "Ask for extra bacon bits",
            userNeed:
                "Ask for extra bacon bits on a baked potato in a restaurant.",
            contextSummary:
                "The user wants a natural US restaurant sentence for requesting an extra topping.",
            primaryLanguageContext:
                "\u7528\u6237\u60f3\u5728\u9910\u5385\u70b9\u70e4\u571f\u8c46\u65f6\uff0c\u8bf7\u670d\u52a1\u5458\u989d\u5916\u52a0\u57f9\u6839\u788e\u3002",
            sourceLanguage: "zh-CN",
            targetLanguage: "en-US",
            status: "extracted",
            createdFrom: "manual_save",
            createdAt: seedDate("2026-06-29T00:31:00.000Z"),
            updatedAt: seedDate("2026-06-29T00:36:00.000Z"),
        },
        inquiryMessages: [
            {
                inquiryId: "inquiry:seed:restaurant-extra-bacon-bits",
                messageId: "message-1",
                role: "primary_question",
                sequence: 1,
            },
            {
                inquiryId: "inquiry:seed:restaurant-extra-bacon-bits",
                messageId: "message-2",
                role: "answer",
                sequence: 2,
            },
        ],
        concepts: [
            {
                id: "concept:seed:bacon-bits",
                canonicalLabel: "bacon bits",
                languageHint: "en-US",
                definition:
                    "Small crunchy pieces of bacon commonly used as a topping.",
                domain: ["food", "restaurant"],
                aliases: ["crumbled bacon", "bacon pieces"],
                status: "active",
                createdAt: seedDate("2026-06-29T00:32:00.000Z"),
                updatedAt: seedDate("2026-06-29T00:36:00.000Z"),
            },
            {
                id: "concept:seed:baked-potato",
                canonicalLabel: "baked potato",
                languageHint: "en-US",
                definition:
                    "A whole potato baked and commonly served with toppings.",
                domain: ["food", "restaurant"],
                aliases: ["jacket potato"],
                status: "active",
                createdAt: seedDate("2026-06-29T00:32:00.000Z"),
                updatedAt: seedDate("2026-06-29T00:36:00.000Z"),
            },
        ],
        expressions: [
            {
                id: "expression:seed:could-i-get-extra",
                text: "Could I get extra ...?",
                language: "en-US",
                normalizedText: "could i get extra",
                partOfSpeech: "sentence frame",
                register: "polite",
                region: "US",
                domain: ["restaurant", "service"],
                meaningNote:
                    "A polite way to ask staff to add more of something.",
                usageNote:
                    "Use with a topping or option: Could I get extra onions?",
                status: "active",
                createdAt: seedDate("2026-06-29T00:33:00.000Z"),
                updatedAt: seedDate("2026-06-29T00:36:00.000Z"),
            },
            {
                id: "expression:seed:bacon-bits",
                text: "bacon bits",
                language: "en-US",
                normalizedText: "bacon bits",
                partOfSpeech: "noun phrase",
                register: "neutral",
                region: "US",
                domain: ["food", "restaurant"],
                meaningNote: "Small bacon pieces used as a topping.",
                usageNote: "Usually plural.",
                status: "active",
                createdAt: seedDate("2026-06-29T00:33:00.000Z"),
                updatedAt: seedDate("2026-06-29T00:36:00.000Z"),
            },
            {
                id: "expression:seed:baked-potato",
                text: "baked potato",
                language: "en-US",
                normalizedText: "baked potato",
                partOfSpeech: "noun phrase",
                register: "neutral",
                region: "US",
                domain: ["food", "restaurant"],
                meaningNote: "A common side dish served with toppings.",
                status: "active",
                createdAt: seedDate("2026-06-29T00:33:00.000Z"),
                updatedAt: seedDate("2026-06-29T00:36:00.000Z"),
            },
        ],
        patterns: [
            {
                id: "pattern:seed:could-i-get-extra-on",
                template: "Could I get extra {topping} on my {food}?",
                language: "en-US",
                slots: [
                    {
                        name: "topping",
                        constraint: "food topping",
                        examples: ["bacon bits", "cheese", "onions"],
                    },
                    {
                        name: "food",
                        constraint: "ordered dish",
                        examples: ["baked potato", "burger", "salad"],
                    },
                ],
                explanation:
                    "Polite restaurant request for adding more of a topping.",
                usageScope: "Ordering food in a casual US restaurant.",
                confidence: 0.94,
                source: "manual",
                status: "active",
                createdAt: seedDate("2026-06-29T00:34:00.000Z"),
                updatedAt: seedDate("2026-06-29T00:36:00.000Z"),
            },
        ],
        knowledgePoints: [
            {
                id: "knowledge-point:seed:restaurant-extra-bacon-bits",
                inquiryId: "inquiry:seed:restaurant-extra-bacon-bits",
                title: "Request extra bacon bits",
                objective:
                    "Use a polite sentence to ask for extra bacon bits on a baked potato.",
                contextSnapshot: {
                    sessionId: "session-current",
                    messageIds: ["message-1", "message-2"],
                    scenario: "restaurant ordering",
                    sourceNeed:
                        "Ask for extra bacon bits on a baked potato in a restaurant.",
                },
                explanation:
                    "'Could I get extra ...?' is polite and natural for asking restaurant staff to modify an order.",
                status: "active",
                createdAt: seedDate("2026-06-29T00:35:00.000Z"),
                updatedAt: seedDate("2026-07-01T02:00:00.000Z"),
            },
        ],
        utterances: [
            {
                id: "utterance:seed:restaurant-extra-bacon-bits:recommended",
                knowledgePointId:
                    "knowledge-point:seed:restaurant-extra-bacon-bits",
                text: "Could I get extra bacon bits on my baked potato?",
                language: "en-US",
                role: "recommended",
                usageNote:
                    "Polite, specific, and natural when the dish is still being ordered.",
                createdAt: seedDate("2026-06-29T00:35:00.000Z"),
            },
            {
                id: "utterance:seed:restaurant-extra-bacon-bits:alternative",
                knowledgePointId:
                    "knowledge-point:seed:restaurant-extra-bacon-bits",
                text: "Can I get extra bacon bits on that?",
                language: "en-US",
                role: "alternative",
                usageNote:
                    "Use after the baked potato has already been mentioned.",
                createdAt: seedDate("2026-06-29T00:35:30.000Z"),
            },
        ],
        knowledgePointEntities: [
            {
                knowledgePointId:
                    "knowledge-point:seed:restaurant-extra-bacon-bits",
                entityType: "expression",
                entityId: "expression:seed:could-i-get-extra",
                role: "supporting",
            },
            {
                knowledgePointId:
                    "knowledge-point:seed:restaurant-extra-bacon-bits",
                entityType: "expression",
                entityId: "expression:seed:bacon-bits",
                role: "primary",
            },
            {
                knowledgePointId:
                    "knowledge-point:seed:restaurant-extra-bacon-bits",
                entityType: "expression",
                entityId: "expression:seed:baked-potato",
                role: "context",
            },
            {
                knowledgePointId:
                    "knowledge-point:seed:restaurant-extra-bacon-bits",
                entityType: "concept",
                entityId: "concept:seed:bacon-bits",
                role: "primary",
            },
            {
                knowledgePointId:
                    "knowledge-point:seed:restaurant-extra-bacon-bits",
                entityType: "concept",
                entityId: "concept:seed:baked-potato",
                role: "context",
            },
            {
                knowledgePointId:
                    "knowledge-point:seed:restaurant-extra-bacon-bits",
                entityType: "pattern",
                entityId: "pattern:seed:could-i-get-extra-on",
                role: "derived",
            },
        ],
        relations: [
            {
                id: "relation:seed:bacon-bits:expresses:concept",
                fromType: "expression",
                fromId: "expression:seed:bacon-bits",
                toType: "concept",
                toId: "concept:seed:bacon-bits",
                type: "expresses",
                direction: "directed",
                confidence: 0.98,
                source: "inquiry",
                status: "confirmed",
                evidence: {
                    inquiryId: "inquiry:seed:restaurant-extra-bacon-bits",
                },
                createdAt: seedDate("2026-06-29T00:36:00.000Z"),
                updatedAt: seedDate("2026-06-29T00:36:00.000Z"),
            },
            {
                id: "relation:seed:baked-potato:expresses:concept",
                fromType: "expression",
                fromId: "expression:seed:baked-potato",
                toType: "concept",
                toId: "concept:seed:baked-potato",
                type: "expresses",
                direction: "directed",
                confidence: 0.98,
                source: "inquiry",
                status: "confirmed",
                evidence: {
                    inquiryId: "inquiry:seed:restaurant-extra-bacon-bits",
                },
                createdAt: seedDate("2026-06-29T00:36:00.000Z"),
                updatedAt: seedDate("2026-06-29T00:36:00.000Z"),
            },
            {
                id: "relation:seed:restaurant-pattern:instantiates:kp",
                fromType: "pattern",
                fromId: "pattern:seed:could-i-get-extra-on",
                toType: "knowledge_point",
                toId: "knowledge-point:seed:restaurant-extra-bacon-bits",
                type: "instantiates",
                direction: "directed",
                confidence: 0.92,
                source: "inquiry",
                status: "confirmed",
                createdAt: seedDate("2026-06-29T00:36:00.000Z"),
                updatedAt: seedDate("2026-06-29T00:36:00.000Z"),
            },
        ],
    },
    {
        inquiry: {
            id: "inquiry:seed:engineering-chamfer-vs-fillet",
            sessionId: "session-archived-1",
            title: "Chamfer vs fillet",
            userNeed:
                "Distinguish chamfer and fillet when describing a part edge.",
            contextSummary:
                "The user asked how to separate two engineering geometry terms in English.",
            primaryLanguageContext:
                "\u7528\u6237\u9700\u8981\u7528\u82f1\u6587\u533a\u5206\u673a\u68b0\u96f6\u4ef6\u8fb9\u7f18\u7684\u5012\u89d2\u548c\u5706\u89d2\u3002",
            sourceLanguage: "zh-CN",
            targetLanguage: "en-US",
            status: "extracted",
            createdFrom: "manual_save",
            createdAt: seedDate("2026-06-27T12:10:00.000Z"),
            updatedAt: seedDate("2026-06-27T12:20:00.000Z"),
        },
        inquiryMessages: [
            {
                inquiryId: "inquiry:seed:engineering-chamfer-vs-fillet",
                messageId: "message-3",
                role: "primary_question",
                sequence: 1,
            },
        ],
        concepts: [
            {
                id: "concept:seed:chamfer",
                canonicalLabel: "chamfer",
                languageHint: "en-US",
                definition:
                    "A flat beveled surface made by cutting off an edge or corner.",
                domain: ["engineering", "manufacturing"],
                aliases: ["beveled edge"],
                status: "active",
                createdAt: seedDate("2026-06-27T12:11:00.000Z"),
                updatedAt: seedDate("2026-06-27T12:20:00.000Z"),
            },
            {
                id: "concept:seed:fillet",
                canonicalLabel: "fillet",
                languageHint: "en-US",
                definition:
                    "A rounded transition or radius between two surfaces.",
                domain: ["engineering", "manufacturing"],
                aliases: ["radius", "rounded edge"],
                disambiguationNote:
                    "In engineering, this is not the food meaning of fillet.",
                status: "active",
                createdAt: seedDate("2026-06-27T12:11:00.000Z"),
                updatedAt: seedDate("2026-06-27T12:20:00.000Z"),
            },
        ],
        expressions: [
            {
                id: "expression:seed:chamfer",
                text: "chamfer",
                language: "en-US",
                normalizedText: "chamfer",
                partOfSpeech: "noun",
                register: "technical",
                domain: ["engineering", "manufacturing"],
                meaningNote: "A flat bevel on an edge.",
                usageNote:
                    "Use when the edge is cut flat at an angle, often 45 degrees.",
                status: "active",
                createdAt: seedDate("2026-06-27T12:12:00.000Z"),
                updatedAt: seedDate("2026-06-27T12:20:00.000Z"),
            },
            {
                id: "expression:seed:fillet",
                text: "fillet",
                language: "en-US",
                normalizedText: "fillet",
                partOfSpeech: "noun",
                register: "technical",
                domain: ["engineering", "manufacturing"],
                meaningNote: "A rounded edge or radius.",
                usageNote: "Use when the transition is curved instead of flat.",
                status: "active",
                createdAt: seedDate("2026-06-27T12:12:00.000Z"),
                updatedAt: seedDate("2026-06-27T12:20:00.000Z"),
            },
        ],
        patterns: [
            {
                id: "pattern:seed:x-means-y-while-z-means-w",
                template:
                    "{x} means {x_definition}, while {z} means {z_definition}.",
                language: "en-US",
                slots: [
                    {
                        name: "x",
                        constraint: "first technical term",
                        examples: ["chamfer"],
                    },
                    {
                        name: "z",
                        constraint: "contrasting technical term",
                        examples: ["fillet"],
                    },
                ],
                explanation:
                    "Contrastive definition frame for closely related terms.",
                usageScope: "Explaining terminology distinctions.",
                confidence: 0.88,
                source: "manual",
                status: "active",
                createdAt: seedDate("2026-06-27T12:13:00.000Z"),
                updatedAt: seedDate("2026-06-27T12:20:00.000Z"),
            },
        ],
        knowledgePoints: [
            {
                id: "knowledge-point:seed:engineering-chamfer-vs-fillet",
                inquiryId: "inquiry:seed:engineering-chamfer-vs-fillet",
                title: "Chamfer vs fillet",
                objective:
                    "Distinguish a flat beveled chamfer from a rounded fillet.",
                contextSnapshot: {
                    sessionId: "session-archived-1",
                    messageIds: ["message-3"],
                    scenario: "engineering terminology",
                    sourceNeed:
                        "Distinguish chamfer and fillet when describing a part edge.",
                },
                explanation:
                    "Chamfer focuses on a flat angled cut, while fillet focuses on a curved radius.",
                status: "active",
                createdAt: seedDate("2026-06-27T12:14:00.000Z"),
                updatedAt: seedDate("2026-07-02T03:00:00.000Z"),
            },
        ],
        utterances: [
            {
                id: "utterance:seed:engineering-chamfer-vs-fillet:recommended",
                knowledgePointId:
                    "knowledge-point:seed:engineering-chamfer-vs-fillet",
                text: "A chamfer is a flat beveled edge; a fillet is a rounded edge or radius.",
                language: "en-US",
                role: "recommended",
                usageNote: "Good for a concise technical explanation.",
                createdAt: seedDate("2026-06-27T12:15:00.000Z"),
            },
            {
                id: "utterance:seed:engineering-chamfer-vs-fillet:contrast",
                knowledgePointId:
                    "knowledge-point:seed:engineering-chamfer-vs-fillet",
                text: "Do not call a flat bevel a fillet.",
                language: "en-US",
                role: "contrast",
                usageNote:
                    "Highlights the most common confusion between the two terms.",
                createdAt: seedDate("2026-06-27T12:15:30.000Z"),
            },
        ],
        knowledgePointEntities: [
            {
                knowledgePointId:
                    "knowledge-point:seed:engineering-chamfer-vs-fillet",
                entityType: "expression",
                entityId: "expression:seed:chamfer",
                role: "primary",
            },
            {
                knowledgePointId:
                    "knowledge-point:seed:engineering-chamfer-vs-fillet",
                entityType: "expression",
                entityId: "expression:seed:fillet",
                role: "contrast",
            },
            {
                knowledgePointId:
                    "knowledge-point:seed:engineering-chamfer-vs-fillet",
                entityType: "concept",
                entityId: "concept:seed:chamfer",
                role: "primary",
            },
            {
                knowledgePointId:
                    "knowledge-point:seed:engineering-chamfer-vs-fillet",
                entityType: "concept",
                entityId: "concept:seed:fillet",
                role: "contrast",
            },
            {
                knowledgePointId:
                    "knowledge-point:seed:engineering-chamfer-vs-fillet",
                entityType: "pattern",
                entityId: "pattern:seed:x-means-y-while-z-means-w",
                role: "derived",
            },
        ],
        relations: [
            {
                id: "relation:seed:chamfer:expresses:concept",
                fromType: "expression",
                fromId: "expression:seed:chamfer",
                toType: "concept",
                toId: "concept:seed:chamfer",
                type: "expresses",
                direction: "directed",
                confidence: 0.99,
                source: "inquiry",
                status: "confirmed",
                createdAt: seedDate("2026-06-27T12:20:00.000Z"),
                updatedAt: seedDate("2026-06-27T12:20:00.000Z"),
            },
            {
                id: "relation:seed:fillet:expresses:concept",
                fromType: "expression",
                fromId: "expression:seed:fillet",
                toType: "concept",
                toId: "concept:seed:fillet",
                type: "expresses",
                direction: "directed",
                confidence: 0.99,
                source: "inquiry",
                status: "confirmed",
                createdAt: seedDate("2026-06-27T12:20:00.000Z"),
                updatedAt: seedDate("2026-06-27T12:20:00.000Z"),
            },
            {
                id: "relation:seed:chamfer:contrast-with:fillet",
                fromType: "concept",
                fromId: "concept:seed:chamfer",
                toType: "concept",
                toId: "concept:seed:fillet",
                type: "contrast_with",
                direction: "undirected",
                confidence: 0.95,
                source: "inquiry",
                status: "confirmed",
                evidence: {
                    distinction:
                        "Flat bevel versus rounded radius in engineering drawings.",
                },
                createdAt: seedDate("2026-06-27T12:20:00.000Z"),
                updatedAt: seedDate("2026-06-27T12:20:00.000Z"),
            },
            {
                id: "relation:seed:engineering-pattern:instantiates:kp",
                fromType: "pattern",
                fromId: "pattern:seed:x-means-y-while-z-means-w",
                toType: "knowledge_point",
                toId: "knowledge-point:seed:engineering-chamfer-vs-fillet",
                type: "instantiates",
                direction: "directed",
                confidence: 0.86,
                source: "inquiry",
                status: "confirmed",
                createdAt: seedDate("2026-06-27T12:20:00.000Z"),
                updatedAt: seedDate("2026-06-27T12:20:00.000Z"),
            },
        ],
    },
    {
        inquiry: {
            id: "inquiry:seed:daily-power-outlet",
            sessionId: "session-archived-2",
            title: "Ask where an outlet is",
            userNeed: "Ask where there is a power outlet nearby.",
            contextSummary:
                "The user needs a natural way to ask for a nearby electrical outlet.",
            primaryLanguageContext:
                "\u7528\u6237\u60f3\u95ee\u9644\u8fd1\u54ea\u91cc\u6709\u63d2\u5ea7\uff0c\u65b9\u4fbf\u7ed9\u8bbe\u5907\u5145\u7535\u3002",
            sourceLanguage: "zh-CN",
            targetLanguage: "en-US",
            status: "extracted",
            createdFrom: "manual_save",
            createdAt: seedDate("2026-06-24T02:15:00.000Z"),
            updatedAt: seedDate("2026-06-24T02:22:00.000Z"),
        },
        inquiryMessages: [
            {
                inquiryId: "inquiry:seed:daily-power-outlet",
                messageId: "message-4",
                role: "primary_question",
                sequence: 1,
            },
        ],
        concepts: [
            {
                id: "concept:seed:power-outlet",
                canonicalLabel: "power outlet",
                languageHint: "en-US",
                definition:
                    "A wall socket or receptacle that supplies electricity.",
                domain: ["daily life", "travel"],
                aliases: ["electrical outlet", "wall outlet", "socket"],
                status: "active",
                createdAt: seedDate("2026-06-24T02:16:00.000Z"),
                updatedAt: seedDate("2026-06-24T02:22:00.000Z"),
            },
        ],
        expressions: [
            {
                id: "expression:seed:power-outlet",
                text: "power outlet",
                language: "en-US",
                normalizedText: "power outlet",
                partOfSpeech: "noun phrase",
                register: "neutral",
                region: "US",
                domain: ["daily life", "travel"],
                meaningNote: "A place where you plug in a charger.",
                usageNote: "Common in American English.",
                status: "active",
                createdAt: seedDate("2026-06-24T02:17:00.000Z"),
                updatedAt: seedDate("2026-06-24T02:22:00.000Z"),
            },
            {
                id: "expression:seed:socket",
                text: "socket",
                language: "en-GB",
                normalizedText: "socket",
                partOfSpeech: "noun",
                register: "neutral",
                region: "UK",
                domain: ["daily life", "travel"],
                meaningNote: "British English for power outlet.",
                usageNote:
                    "In the US, socket is understood but outlet is more common.",
                status: "active",
                createdAt: seedDate("2026-06-24T02:17:00.000Z"),
                updatedAt: seedDate("2026-06-24T02:22:00.000Z"),
            },
            {
                id: "expression:seed:is-there-an-outlet-nearby",
                text: "Is there an outlet nearby?",
                language: "en-US",
                normalizedText: "is there an outlet nearby",
                partOfSpeech: "sentence",
                register: "neutral",
                region: "US",
                domain: ["daily life", "travel"],
                meaningNote:
                    "A natural question when looking for somewhere to charge a device.",
                status: "active",
                createdAt: seedDate("2026-06-24T02:17:00.000Z"),
                updatedAt: seedDate("2026-06-24T02:22:00.000Z"),
            },
        ],
        patterns: [
            {
                id: "pattern:seed:is-there-a-resource-nearby",
                template: "Is there a {resource} nearby?",
                language: "en-US",
                slots: [
                    {
                        name: "resource",
                        constraint: "place or thing the speaker needs",
                        examples: ["bathroom", "power outlet", "ATM"],
                    },
                ],
                explanation:
                    "Basic availability question for finding a useful thing nearby.",
                usageScope: "Travel, cafes, airports, public places.",
                confidence: 0.91,
                source: "manual",
                status: "active",
                createdAt: seedDate("2026-06-24T02:18:00.000Z"),
                updatedAt: seedDate("2026-06-24T02:22:00.000Z"),
            },
        ],
        knowledgePoints: [
            {
                id: "knowledge-point:seed:daily-power-outlet",
                inquiryId: "inquiry:seed:daily-power-outlet",
                title: "Ask for a nearby outlet",
                objective:
                    "Ask naturally whether there is a power outlet nearby.",
                contextSnapshot: {
                    sessionId: "session-archived-2",
                    messageIds: ["message-4"],
                    scenario: "public place",
                    sourceNeed: "Ask where there is a power outlet nearby.",
                },
                explanation:
                    "Outlet is the common US term; socket is more common in British English.",
                status: "active",
                createdAt: seedDate("2026-06-24T02:19:00.000Z"),
                updatedAt: seedDate("2026-06-25T02:00:00.000Z"),
            },
        ],
        utterances: [
            {
                id: "utterance:seed:daily-power-outlet:recommended",
                knowledgePointId: "knowledge-point:seed:daily-power-outlet",
                text: "Is there an outlet nearby?",
                language: "en-US",
                role: "recommended",
                usageNote:
                    "Short and natural in a cafe, airport, or classroom.",
                createdAt: seedDate("2026-06-24T02:20:00.000Z"),
            },
            {
                id: "utterance:seed:daily-power-outlet:alternative",
                knowledgePointId: "knowledge-point:seed:daily-power-outlet",
                text: "Do you know where I can plug in my charger?",
                language: "en-US",
                role: "alternative",
                usageNote:
                    "Useful when asking a person for help instead of just asking whether one exists.",
                createdAt: seedDate("2026-06-24T02:20:30.000Z"),
            },
        ],
        knowledgePointEntities: [
            {
                knowledgePointId: "knowledge-point:seed:daily-power-outlet",
                entityType: "expression",
                entityId: "expression:seed:power-outlet",
                role: "primary",
            },
            {
                knowledgePointId: "knowledge-point:seed:daily-power-outlet",
                entityType: "expression",
                entityId: "expression:seed:is-there-an-outlet-nearby",
                role: "supporting",
            },
            {
                knowledgePointId: "knowledge-point:seed:daily-power-outlet",
                entityType: "expression",
                entityId: "expression:seed:socket",
                role: "contrast",
            },
            {
                knowledgePointId: "knowledge-point:seed:daily-power-outlet",
                entityType: "concept",
                entityId: "concept:seed:power-outlet",
                role: "primary",
            },
            {
                knowledgePointId: "knowledge-point:seed:daily-power-outlet",
                entityType: "pattern",
                entityId: "pattern:seed:is-there-a-resource-nearby",
                role: "derived",
            },
        ],
        relations: [
            {
                id: "relation:seed:power-outlet:expresses:concept",
                fromType: "expression",
                fromId: "expression:seed:power-outlet",
                toType: "concept",
                toId: "concept:seed:power-outlet",
                type: "expresses",
                direction: "directed",
                confidence: 0.98,
                source: "inquiry",
                status: "confirmed",
                createdAt: seedDate("2026-06-24T02:22:00.000Z"),
                updatedAt: seedDate("2026-06-24T02:22:00.000Z"),
            },
            {
                id: "relation:seed:socket:variant-of:power-outlet",
                fromType: "expression",
                fromId: "expression:seed:socket",
                toType: "expression",
                toId: "expression:seed:power-outlet",
                type: "variant_of",
                direction: "directed",
                confidence: 0.82,
                source: "inquiry",
                status: "confirmed",
                evidence: {
                    regionalNote: "socket is more common in British English",
                },
                createdAt: seedDate("2026-06-24T02:22:00.000Z"),
                updatedAt: seedDate("2026-06-24T02:22:00.000Z"),
            },
            {
                id: "relation:seed:outlet-pattern:instantiates:kp",
                fromType: "pattern",
                fromId: "pattern:seed:is-there-a-resource-nearby",
                toType: "knowledge_point",
                toId: "knowledge-point:seed:daily-power-outlet",
                type: "instantiates",
                direction: "directed",
                confidence: 0.89,
                source: "inquiry",
                status: "confirmed",
                createdAt: seedDate("2026-06-24T02:22:00.000Z"),
                updatedAt: seedDate("2026-06-24T02:22:00.000Z"),
            },
        ],
    },
];

const seedLearningTargets: LearningTargetDraft[] = [
    {
        target: {
            id: "target:seed:restaurant:bacon-bits:recall",
            userId: SEED_USER_ID,
            knowledgePointId:
                "knowledge-point:seed:restaurant-extra-bacon-bits",
            ability: "recall",
            status: "active",
            priority: 8,
            difficulty: "low",
            stability: 0.35,
            dueAt: seedDate("2026-06-30T02:00:00.000Z"),
            reviewCount: 0,
            lapseCount: 0,
            schedulingAlgorithm: "seed",
            schedulingVersion: "1",
            createdAt: seedDate("2026-06-29T00:40:00.000Z"),
            updatedAt: seedDate("2026-06-30T02:00:00.000Z"),
        },
        entities: [
            {
                learningTargetId: "target:seed:restaurant:bacon-bits:recall",
                entityType: "expression",
                entityId: "expression:seed:bacon-bits",
                role: "primary",
            },
            {
                learningTargetId: "target:seed:restaurant:bacon-bits:recall",
                entityType: "concept",
                entityId: "concept:seed:bacon-bits",
                role: "prompt",
            },
            {
                learningTargetId: "target:seed:restaurant:bacon-bits:recall",
                entityType: "utterance",
                entityId:
                    "utterance:seed:restaurant-extra-bacon-bits:recommended",
                role: "supporting",
            },
        ],
    },
    {
        target: {
            id: "target:seed:restaurant:request:contextual-production",
            userId: SEED_USER_ID,
            knowledgePointId:
                "knowledge-point:seed:restaurant-extra-bacon-bits",
            ability: "contextual_production",
            status: "active",
            priority: 9,
            difficulty: "medium",
            stability: 0.2,
            dueAt: seedDate("2026-07-01T02:00:00.000Z"),
            reviewCount: 1,
            lapseCount: 0,
            schedulingAlgorithm: "seed",
            schedulingVersion: "1",
            createdAt: seedDate("2026-06-29T00:41:00.000Z"),
            updatedAt: seedDate("2026-07-01T02:00:00.000Z"),
        },
        entities: [
            {
                learningTargetId:
                    "target:seed:restaurant:request:contextual-production",
                entityType: "utterance",
                entityId:
                    "utterance:seed:restaurant-extra-bacon-bits:recommended",
                role: "primary",
            },
            {
                learningTargetId:
                    "target:seed:restaurant:request:contextual-production",
                entityType: "expression",
                entityId: "expression:seed:could-i-get-extra",
                role: "required",
            },
            {
                learningTargetId:
                    "target:seed:restaurant:request:contextual-production",
                entityType: "expression",
                entityId: "expression:seed:bacon-bits",
                role: "required",
            },
            {
                learningTargetId:
                    "target:seed:restaurant:request:contextual-production",
                entityType: "pattern",
                entityId: "pattern:seed:could-i-get-extra-on",
                role: "supporting",
            },
        ],
    },
    {
        target: {
            id: "target:seed:engineering:chamfer-fillet:distinction",
            userId: SEED_USER_ID,
            knowledgePointId:
                "knowledge-point:seed:engineering-chamfer-vs-fillet",
            ability: "distinction",
            status: "active",
            priority: 7,
            difficulty: "high",
            stability: 0.28,
            dueAt: seedDate("2026-07-02T02:00:00.000Z"),
            reviewCount: 0,
            lapseCount: 0,
            schedulingAlgorithm: "seed",
            schedulingVersion: "1",
            createdAt: seedDate("2026-06-27T12:25:00.000Z"),
            updatedAt: seedDate("2026-07-02T02:00:00.000Z"),
        },
        entities: [
            {
                learningTargetId:
                    "target:seed:engineering:chamfer-fillet:distinction",
                entityType: "concept",
                entityId: "concept:seed:chamfer",
                role: "primary",
            },
            {
                learningTargetId:
                    "target:seed:engineering:chamfer-fillet:distinction",
                entityType: "concept",
                entityId: "concept:seed:fillet",
                role: "contrast",
            },
            {
                learningTargetId:
                    "target:seed:engineering:chamfer-fillet:distinction",
                entityType: "expression",
                entityId: "expression:seed:chamfer",
                role: "required",
            },
            {
                learningTargetId:
                    "target:seed:engineering:chamfer-fillet:distinction",
                entityType: "expression",
                entityId: "expression:seed:fillet",
                role: "contrast",
            },
            {
                learningTargetId:
                    "target:seed:engineering:chamfer-fillet:distinction",
                entityType: "utterance",
                entityId:
                    "utterance:seed:engineering-chamfer-vs-fillet:recommended",
                role: "supporting",
            },
        ],
    },
    {
        target: {
            id: "target:seed:outlet:power-outlet:recognition",
            userId: SEED_USER_ID,
            knowledgePointId: "knowledge-point:seed:daily-power-outlet",
            ability: "recognition",
            status: "active",
            priority: 5,
            difficulty: "low",
            stability: 1.1,
            dueAt: seedDate("2026-07-10T02:00:00.000Z"),
            lastReviewedAt: seedDate("2026-06-25T02:00:00.000Z"),
            reviewCount: 2,
            lapseCount: 0,
            schedulingAlgorithm: "seed",
            schedulingVersion: "1",
            createdAt: seedDate("2026-06-24T02:25:00.000Z"),
            updatedAt: seedDate("2026-06-25T02:00:00.000Z"),
        },
        entities: [
            {
                learningTargetId: "target:seed:outlet:power-outlet:recognition",
                entityType: "expression",
                entityId: "expression:seed:power-outlet",
                role: "primary",
            },
            {
                learningTargetId: "target:seed:outlet:power-outlet:recognition",
                entityType: "expression",
                entityId: "expression:seed:socket",
                role: "contrast",
            },
            {
                learningTargetId: "target:seed:outlet:power-outlet:recognition",
                entityType: "concept",
                entityId: "concept:seed:power-outlet",
                role: "prompt",
            },
        ],
    },
    {
        target: {
            id: "target:seed:outlet:ask-nearby:contextual-production",
            userId: SEED_USER_ID,
            knowledgePointId: "knowledge-point:seed:daily-power-outlet",
            ability: "contextual_production",
            status: "mastered",
            priority: 4,
            difficulty: "low",
            stability: 2.4,
            dueAt: seedDate("2026-07-20T02:00:00.000Z"),
            lastReviewedAt: seedDate("2026-06-26T02:00:00.000Z"),
            reviewCount: 4,
            lapseCount: 0,
            schedulingAlgorithm: "seed",
            schedulingVersion: "1",
            createdAt: seedDate("2026-06-24T02:26:00.000Z"),
            updatedAt: seedDate("2026-06-26T02:00:00.000Z"),
        },
        entities: [
            {
                learningTargetId:
                    "target:seed:outlet:ask-nearby:contextual-production",
                entityType: "utterance",
                entityId: "utterance:seed:daily-power-outlet:recommended",
                role: "primary",
            },
            {
                learningTargetId:
                    "target:seed:outlet:ask-nearby:contextual-production",
                entityType: "pattern",
                entityId: "pattern:seed:is-there-a-resource-nearby",
                role: "supporting",
            },
        ],
    },
];

const seedPracticeItems: PracticeItemDraft[] = [
    {
        item: {
            id: "practice:seed:restaurant:bacon-bits:flashcard",
            type: "flashcard",
            prompt: {
                front: "What phrase names small crunchy bacon pieces used as a topping?",
                mode: "recall",
            },
            expectedAnswer: "bacon bits",
            acceptableAnswers: ["bacon bits", "extra bacon bits"],
            contextSnapshot: {
                learningTargetId: "target:seed:restaurant:bacon-bits:recall",
                knowledgePointId:
                    "knowledge-point:seed:restaurant-extra-bacon-bits",
                source: "seed",
            },
            generatedAt: seedDate("2026-06-30T02:30:00.000Z"),
        },
        targets: [
            {
                practiceItemId: "practice:seed:restaurant:bacon-bits:flashcard",
                learningTargetId: "target:seed:restaurant:bacon-bits:recall",
                weight: 1,
            },
        ],
    },
    {
        item: {
            id: "practice:seed:restaurant:request:scenario",
            type: "scenario_response",
            prompt: {
                scenario:
                    "You are ordering a baked potato and want more bacon pieces.",
                task: "Ask the server politely.",
            },
            expectedAnswer: "Could I get extra bacon bits on my baked potato?",
            acceptableAnswers: [
                "Could I get extra bacon bits on my baked potato?",
                "Can I get extra bacon bits on that?",
            ],
            contextSnapshot: {
                learningTargetId:
                    "target:seed:restaurant:request:contextual-production",
                knowledgePointId:
                    "knowledge-point:seed:restaurant-extra-bacon-bits",
                source: "seed",
            },
            generatedAt: seedDate("2026-07-01T02:30:00.000Z"),
        },
        targets: [
            {
                practiceItemId: "practice:seed:restaurant:request:scenario",
                learningTargetId:
                    "target:seed:restaurant:request:contextual-production",
                weight: 1,
            },
            {
                practiceItemId: "practice:seed:restaurant:request:scenario",
                learningTargetId: "target:seed:restaurant:bacon-bits:recall",
                weight: 0.4,
            },
        ],
    },
    {
        item: {
            id: "practice:seed:engineering:chamfer-fillet:choice",
            type: "multiple_choice",
            prompt: {
                question:
                    "Which term means a flat beveled edge rather than a rounded radius?",
                options: ["fillet", "chamfer", "socket", "radius"],
            },
            expectedAnswer: "chamfer",
            acceptableAnswers: ["chamfer"],
            contextSnapshot: {
                learningTargetId:
                    "target:seed:engineering:chamfer-fillet:distinction",
                knowledgePointId:
                    "knowledge-point:seed:engineering-chamfer-vs-fillet",
                source: "seed",
            },
            generatedAt: seedDate("2026-07-02T02:30:00.000Z"),
        },
        targets: [
            {
                practiceItemId:
                    "practice:seed:engineering:chamfer-fillet:choice",
                learningTargetId:
                    "target:seed:engineering:chamfer-fillet:distinction",
                weight: 1,
            },
        ],
    },
    {
        item: {
            id: "practice:seed:engineering:fillet-correction",
            type: "correction",
            prompt: {
                sentence: "The drawing calls for a fillet on this flat bevel.",
                task: "Replace the incorrect term.",
            },
            expectedAnswer:
                "The drawing calls for a chamfer on this flat bevel.",
            acceptableAnswers: [
                "The drawing calls for a chamfer on this flat bevel.",
                "It should be chamfer, not fillet.",
            ],
            contextSnapshot: {
                learningTargetId:
                    "target:seed:engineering:chamfer-fillet:distinction",
                knowledgePointId:
                    "knowledge-point:seed:engineering-chamfer-vs-fillet",
                source: "seed",
            },
            generatedAt: seedDate("2026-07-02T03:00:00.000Z"),
        },
        targets: [
            {
                practiceItemId: "practice:seed:engineering:fillet-correction",
                learningTargetId:
                    "target:seed:engineering:chamfer-fillet:distinction",
                weight: 0.9,
            },
        ],
    },
    {
        item: {
            id: "practice:seed:outlet:nearby-translation",
            type: "translation",
            prompt: {
                sourceText: "Ask if there is a power outlet nearby.",
                targetLanguage: "en-US",
            },
            expectedAnswer: "Is there an outlet nearby?",
            acceptableAnswers: [
                "Is there an outlet nearby?",
                "Is there a power outlet nearby?",
                "Do you know where I can plug in my charger?",
            ],
            contextSnapshot: {
                learningTargetId:
                    "target:seed:outlet:ask-nearby:contextual-production",
                knowledgePointId: "knowledge-point:seed:daily-power-outlet",
                source: "seed",
            },
            generatedAt: seedDate("2026-06-25T02:30:00.000Z"),
        },
        targets: [
            {
                practiceItemId: "practice:seed:outlet:nearby-translation",
                learningTargetId:
                    "target:seed:outlet:ask-nearby:contextual-production",
                weight: 1,
            },
            {
                practiceItemId: "practice:seed:outlet:nearby-translation",
                learningTargetId: "target:seed:outlet:power-outlet:recognition",
                weight: 0.4,
            },
        ],
    },
];

const seedPracticeResponses: PracticeResponseDraft[] = [
    {
        response: {
            id: "response:seed:restaurant:bacon-bits:correct",
            practiceItemId: "practice:seed:restaurant:bacon-bits:flashcard",
            userId: SEED_USER_ID,
            answer: "bacon bits",
            submittedAt: seedDate("2026-07-01T01:30:00.000Z"),
            feedback: {
                summary: "Correct. Keep the plural form.",
            },
        },
        evidence: [
            {
                id: "evidence:seed:restaurant:bacon-bits:correct",
                userResponseId: "response:seed:restaurant:bacon-bits:correct",
                learningTargetId: "target:seed:restaurant:bacon-bits:recall",
                result: "correct",
                confidence: 0.92,
                createdAt: seedDate("2026-07-01T01:30:00.000Z"),
            },
        ],
    },
    {
        response: {
            id: "response:seed:restaurant:request:partial",
            practiceItemId: "practice:seed:restaurant:request:scenario",
            userId: SEED_USER_ID,
            answer: "Can I have more bacon on the potato?",
            submittedAt: seedDate("2026-07-01T01:35:00.000Z"),
            feedback: {
                summary:
                    "Understandable, but it missed the target phrase bacon bits.",
            },
        },
        evidence: [
            {
                id: "evidence:seed:restaurant:request:partial",
                userResponseId: "response:seed:restaurant:request:partial",
                learningTargetId:
                    "target:seed:restaurant:request:contextual-production",
                result: "partial",
                confidence: 0.58,
                error: {
                    missing: ["bacon bits", "Could I get extra ...?"],
                },
                createdAt: seedDate("2026-07-01T01:35:00.000Z"),
            },
        ],
    },
];

export async function seedMockKnowledgePractice(
    db: SQLiteDatabase
): Promise<void> {
    const { knowledge, practice } = getLanguageFrictionRepositories(db);
    const practiceDao = new PracticeDao(db);

    for (const extraction of seedInquiryExtractions) {
        await knowledge.saveInquiryExtraction(extraction);
    }

    await practice.saveLearningTargets(seedLearningTargets);
    await practice.savePracticeItems(seedPracticeItems);

    for (const response of seedPracticeResponses) {
        const existingResponse = await practiceDao.getUserResponseById(
            response.response.id
        );

        if (!existingResponse) {
            await practice.recordResponse(response);
        }
    }
}
