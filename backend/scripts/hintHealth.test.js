const { parseArgs, buildAssignmentIndex, aggregate, isAlarming, anyAlarm, formatReport, toMs } = require('./hintHealth');

const rows = [
    { id: 1, template_id: null, project_name: 'M1', hints: [{ id: 'h0', when: { type: 'mission_intro' } }, { id: 'h1', when: { type: 'block' } }] },
    { id: 2, template_id: 1, project_name: null, hints: [] }, // referência herda do template 1
];
const idx = buildAssignmentIndex(rows);
const ev = (s, a, h, t, at) => ({ student_id: s, assignment_id: a, hint_id: h, event_type: t, created_at: at });

describe('hintHealth', () => {
    test('referência herda intro e agrupa no template', () => {
        expect(idx.get(2).templateId).toBe(1);
        expect(idx.get(2).introIds.has('h0')).toBe(true);
    });

    test('conta proativa só DEPOIS da intro dispensada, por dia e alertas', () => {
        const events = [
            ev('a', 1, 'h0', 'shown', '2026-10-01T10:00:00'),
            ev('a', 1, 'h0', 'dismissed', '2026-10-01T10:01:00'),
            ev('a', 1, 'h1', 'shown', '2026-10-01T10:05:00'),
            ev('a', 1, 'h1', 'wrong_value', '2026-10-01T10:06:00'),
            ev('b', 2, 'h1', 'shown', '2026-10-01T09:00:00'), // antes da intro: não conta
            ev('b', 2, 'h0', 'dismissed', '2026-10-01T10:00:00'),
            ev('c', 1, 'h0', 'dismissed', '2026-10-02T10:00:00'),
        ];
        const r = aggregate(events, idx);
        expect(r.templates).toHaveLength(1);
        const [d1, d2] = r.templates[0].days;
        expect(d1.day).toBe('2026-10-01');
        expect(d1.introDismissed).toBe(2);
        expect(d1.proactiveAfterIntro).toBe(1);
        expect(d1.alerts.wrong_value).toBe(1);
        expect(d2.introDismissed).toBe(1);
        expect(r.total.introDismissed).toBe(3);
        expect(r.total.proactiveAfterIntro).toBe(1);
    });

    test('alarme: <5% com >=5 alunos; não com poucos alunos', () => {
        const mk = (n) => Array.from({ length: n }, (_, i) => ev('s' + i, 1, 'h0', 'dismissed', '2026-10-01T10:00:00'));
        expect(isAlarming(aggregate(mk(5), idx).total)).toBe(true);
        expect(isAlarming(aggregate(mk(4), idx).total)).toBe(false);
        const withPro = mk(5).concat([ev('s0', 1, 'h1', 'shown', '2026-10-01T11:00:00')]);
        expect(isAlarming(aggregate(withPro, idx).total)).toBe(false); // 20%
        expect(anyAlarm(aggregate(mk(5), idx))).toBe(true);
    });

    test('relatório traz linha ALERTA e não vaza ids de alunos', () => {
        const events = Array.from({ length: 6 }, (_, i) => ev('aluno-secreto-' + i, 1, 'h0', 'dismissed', '2026-10-01T10:00:00'));
        const txt = formatReport(aggregate(events, idx), { since: '2026-09-28' });
        expect(txt).toMatch(/ALERTA/);
        expect(txt).not.toMatch(/aluno-secreto/);
    });

    test('conta wrong_extra (alerta de bloco a mais da Fase 3) e mostra a coluna', () => {
        const events = [
            ev('a', 1, 'h0', 'dismissed', '2026-10-01T10:00:00'),
            ev('a', 1, 'h1', 'wrong_extra', '2026-10-01T10:02:00'),
            ev('a', 1, 'h1', 'wrong_extra', '2026-10-01T10:03:00'),
        ];
        const r = aggregate(events, idx);
        expect(r.total.alerts.wrong_extra).toBe(2);
        expect(formatReport(r, { since: '2026-09-28' })).toMatch(/w_extra/);
    });

    test('parseArgs e timestamps sem fuso', () => {
        const o = parseArgs(['--since', '2026-09-28', '--json', '--strict', '--assignment', '7']);
        expect(o).toMatchObject({ since: '2026-09-28', json: true, strict: true, assignment: 7 });
        expect(parseArgs([], new Date('2026-10-30T00:00:00Z')).since).toBe('2026-10-16');
        expect(() => parseArgs(['--since', 'x'])).toThrow();
        expect(toMs('2026-10-01T10:00:00')).toBe(Date.parse('2026-10-01T10:00:00Z'));
    });
});
