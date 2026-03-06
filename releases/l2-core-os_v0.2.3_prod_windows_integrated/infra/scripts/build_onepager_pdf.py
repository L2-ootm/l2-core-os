from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from textwrap import wrap

out = r"C:\Users\Davi\Desktop\Projetos\L2 CORE OS\SALES_DEMO_ONE_PAGER.pdf"
lines = [
    "L2 CORE OS — One Pager Comercial (MVP)",
    "",
    "Headline: Infraestrutura invisível para clínicas operarem com previsibilidade, sem depender de software complexo.",
    "",
    "Problema: confirmações/remarcações desorganizadas, retrabalho manual no WhatsApp, falta de rastreabilidade.",
    "",
    "Solução: automação WhatsApp (Baileys), API segura (RBAC/JWT + rate limit + webhook assinado), sync incremental Android-first e fallback determinístico sem custo cloud.",
    "",
    "Diferenciais: setup local sem custo mensal obrigatório; arquitetura agnóstica; idempotência + reconciliação; MVP validado com GO/NO-GO.",
    "",
    "Prova técnica: 10/10 checks E2E; stack containerizada; runbooks completos.",
    "",
    "Modelo de adoção: instalação local -> conexão WhatsApp via QR -> parametrização via wizard -> operação assistida.",
    "",
    "Próximo passo: piloto em 1 clínica com métricas verificáveis de confirmação/no-show/tempo operacional.",
    "",
    "CTA: Solicite demonstração técnica guiada (30 min).",
]

c = canvas.Canvas(out, pagesize=A4)
W, H = A4
y = H - 50
c.setFont("Helvetica-Bold", 14)
c.drawString(40, y, lines[0])
y -= 30
c.setFont("Helvetica", 10)
for ln in lines[1:]:
    wrapped = wrap(ln, 100) if ln else [""]
    for w in wrapped:
        if y < 50:
            c.showPage()
            c.setFont("Helvetica", 10)
            y = H - 50
        c.drawString(40, y, w)
        y -= 14
c.save()
print(out)
