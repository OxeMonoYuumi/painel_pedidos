import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const requiredFields = ['cliente', 'setor', 'servico', 'valor', 'data_pedido'];

Deno.serve(async (request) => {
    if (request.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const authorization = request.headers.get('Authorization');
        if (!authorization) throw new Error('Usuário não autenticado.');

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: authorization } } }
        );
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) throw new Error('Usuário não autenticado.');

        const { messages } = await request.json();
        if (!Array.isArray(messages) || messages.length === 0) {
            throw new Error('Conversa inválida.');
        }
        const conversation = messages
            .filter((message) => message && (message.role === 'user' || message.role === 'assistant'))
            .map((message) => ({ role: message.role, content: String(message.content).slice(0, 4000) }));
        if (conversation.length === 0) throw new Error('Conversa inválida.');

        const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${Deno.env.get('GROQ_API_KEY')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                temperature: 0.2,
                response_format: { type: 'json_object' },
                messages: [
                    {
                        role: 'system',
                        content: `Você é um atendente de pedidos em português do Brasil. Colete apenas informações fornecidas pelo cliente e peça os campos faltantes. Campos obrigatórios: cliente, setor, servico, valor numérico em reais e data_pedido. telefone e observacoes são opcionais. status deve ser "Pendente" se não informado. Nunca invente dados e nunca diga que salvou se complete não for true. Responda SOMENTE JSON válido neste formato: {"message":"resposta curta ao cliente","complete":false,"order":{"cliente":"","telefone":"","setor":"","servico":"","valor":0,"data_pedido":"","status":"Pendente","observacoes":""}}. Quando todos os campos obrigatórios estiverem confirmados, use complete true.`
                    },
                    ...conversation
                ]
            })
        });

        if (!groqResponse.ok) throw new Error('Falha ao consultar o atendente.');
        const completion = await groqResponse.json();
        const result = JSON.parse(completion.choices[0].message.content);
        const order = result.order ?? {};

        const hasRequiredFields = requiredFields.every((field) => {
            const value = order[field];
            return value !== undefined && value !== null && value !== '' && !(field === 'valor' && Number.isNaN(Number(value)));
        });

        if (!result.complete || !hasRequiredFields) {
            return jsonResponse({ message: result.message, saved: false });
        }

        const { error: insertError } = await supabase.from('pedidos').insert({
            user_id: user.id,
            cliente: String(order.cliente),
            telefone: order.telefone ? String(order.telefone) : '',
            setor: String(order.setor),
            servico: String(order.servico),
            valor: Number(order.valor),
            data_pedido: String(order.data_pedido),
            status: ['Pendente', 'Em produção', 'Confirmado', 'Cancelado'].includes(order.status)
                ? order.status
                : 'Pendente',
            observacoes: order.observacoes ? String(order.observacoes) : ''
        });
        if (insertError) throw insertError;

        return jsonResponse({ message: 'Pedido registrado com sucesso!', saved: true });
    } catch (error) {
        console.error(error);
        return jsonResponse({ error: error instanceof Error ? error.message : 'Erro interno.' }, 400);
    }
});

function jsonResponse(body: Record<string, unknown>, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
}