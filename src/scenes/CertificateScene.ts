import Phaser from 'phaser';
import {
  certificateRows, certificateTitle, certificateTopic, getCertificate, pendingCertificate, presentCertificate, type AreaRecord,
  type Certificate, type CertificateId,
} from '../core/certificates';
import { agree, listJoin, percent, plural } from '../core/fmt';
import { game, save } from '../core/store';
import { getLesson } from '../data/lessons';
import { MINIGAME_AREAS } from '../data/nodes';
import { getTier, TIERS } from '../data/tiers';
import { button, COLORS, fitText, header, panel, textStyle, WIDTH } from '../ui/widgets';
import type { FormaturaData } from './FormaturaScene';
import type { HubData } from './HubScene';

export interface CertificateData {
  /** Absent: the list of earned certificates. */
  id?: CertificateId;
  /** Set by the formatura: "Continuar" leads to its closing screen. */
  after?: 'epilogue';
}

const LEFT = 60;
const RIGHT = WIDTH - 60;
const ROW = 26;
const LESSONS_TOP = 540;
const LESSONS_HEIGHT = 96;

/**
 * One certificate: name and title first, then the area table, then the
 * lessons completed. Reopened from the Hub, it shows the numbers it was
 * earned with beside the current ones. Opened on a certificate not yet
 * presented, it is that tier's ceremony.
 */
export class CertificateScene extends Phaser.Scene {
  constructor() {
    super('Certificate');
  }

  create(data: CertificateData = {}) {
    this.cameras.main.setBackgroundColor(COLORS.bg);
    const certificate = data.id ? getCertificate(game(), data.id) : undefined;
    if (!certificate) {
      this.showList();
      return;
    }
    const ceremony = !certificate.presented;
    const reopened = !ceremony && !data.after;
    header(this, certificateTitle(certificate.id), reopened ? () => this.scene.start('Certificate', {}) : undefined);
    this.drawCertificate(certificate, reopened);

    if (reopened) return;
    button(this, WIDTH / 2 - 150, 664, 300, 46, 'Continuar', () => {
      if (data.after === 'epilogue') {
        const next: FormaturaData = { step: 'epilogue' };
        this.scene.start('Formatura', next);
        return;
      }
      presentCertificate(game(), certificate.id);
      save();
      const hub: HubData = { notice: tierNotice(certificate.id) };
      this.scene.start('Hub', hub);
    }, { size: 20, color: COLORS.warn });
  }

  private showList() {
    header(this, 'Certificados', () => this.scene.start('Hub'));
    const earned = game().certificates.filter((c) => c.presented);
    this.add.text(WIDTH / 2, 90, 'Escolha um certificado para ver os números de quando você recebeu e os de agora.', textStyle(17, COLORS.info)).setOrigin(0.5);
    earned.forEach((c, i) => {
      button(this, WIDTH / 2 - 300, 140 + i * 90, 600, 70, `${certificateTitle(c.id)} · ${certificateTopic(c.id)}`, () => {
        const data: CertificateData = { id: c.id };
        this.scene.start('Certificate', data);
      }, { size: 20, color: COLORS.warn });
    });
  }

  private drawCertificate(certificate: Certificate, reopened: boolean) {
    const state = game();
    panel(this, 40, 66, WIDTH - 80, 590, COLORS.warn);
    this.add.text(WIDTH / 2, 80, 'ROOTKIT ACADEMY', textStyle(14, COLORS.muted)).setOrigin(0.5, 0);
    const tier = certificate.id === 'conclusao' ? null : getTier(certificate.id);
    const title = tier ? `${tier.title} · ${tier.topic}` : certificateTitle('conclusao');
    fitText(this.add.text(WIDTH / 2, 100, title, textStyle(28, COLORS.accent)).setOrigin(0.5, 0), RIGHT - LEFT);
    this.add.text(WIDTH / 2, 142, 'Certificamos que', textStyle(15, COLORS.muted)).setOrigin(0.5, 0);
    // A tier ceremony shows the name before presenting copies it into the certificate.
    fitText(this.add.text(WIDTH / 2, 162, certificate.name ?? state.studentName ?? '', textStyle(32, COLORS.warn)).setOrigin(0.5, 0), RIGHT - LEFT);
    const what = tier
      ? `concluiu ${agree(tier.gender, 'o', 'a')} ${tier.title}, sobre ${tier.topic}.`
      : 'concluiu o curso e o exercício final do laboratório de segurança.';
    fitText(this.add.text(WIDTH / 2, 204, what, textStyle(16, COLORS.text)).setOrigin(0.5, 0), RIGHT - LEFT);

    this.drawAreas(certificate, reopened);

    const lessons = certificate.snapshot.lessons.map((id) => getLesson(id).title);
    this.add.text(LEFT, LESSONS_TOP - 24, `Aulas concluídas (${lessons.length})`, textStyle(15, COLORS.info));
    this.drawLessons(listJoin(lessons));
    if (reopened && state.lessonsCompleted.length > lessons.length) {
      const later = state.lessonsCompleted.length - lessons.length;
      this.add.text(RIGHT, LESSONS_TOP - 24, `agora: + ${plural(later, 'aula', 'aulas')}`, textStyle(13, COLORS.muted)).setOrigin(1, 0);
    }
  }

  /** The area table; reopened, the earned numbers sit beside the current ones. */
  private drawAreas(certificate: Certificate, reopened: boolean) {
    const rows = certificateRows(game(), certificate).filter((r) => reopened || r.earned);
    const top = 240;
    if (rows.length === 0) {
      this.add.text(WIDTH / 2, top + 40, 'Nenhuma etapa de invasão respondida ainda.', textStyle(16, COLORS.muted)).setOrigin(0.5, 0);
      return;
    }
    const areaWidth = 210;
    const sides: { label: string; pick: (r: (typeof rows)[number]) => AreaRecord | null }[] = reopened
      ? [{ label: 'Quando recebeu', pick: (r) => r.earned }, { label: 'Agora', pick: (r) => r.current }]
      : [{ label: '', pick: (r) => r.earned }];
    const sideWidth = (RIGHT - LEFT - areaWidth) / sides.length;
    const columns = [0.38, 0.47, 0.15];
    const headers = ['Acertos', 'Conceitos', 'Nível'];

    this.add.text(LEFT, top + 18, 'Área', textStyle(14, COLORS.info));
    sides.forEach((side, s) => {
      const x0 = LEFT + areaWidth + s * sideWidth;
      if (side.label) this.add.text(x0, top, side.label.toUpperCase(), textStyle(13, COLORS.muted));
      let x = x0;
      headers.forEach((h, c) => {
        this.add.text(x, top + 18, h, textStyle(14, COLORS.info));
        x += sideWidth * columns[c];
      });
    });

    rows.forEach((row, i) => {
      const y = top + 44 + i * ROW;
      fitText(this.add.text(LEFT, y, MINIGAME_AREAS[row.area], textStyle(15, COLORS.text)), areaWidth - 10);
      sides.forEach((side, s) => {
        const record = side.pick(row);
        const cells = record
          ? [`${percent(record.correct, record.answered)} (${record.correct} de ${record.answered})`,
            `${plural(record.learned, 'aprendido', 'aprendidos')} · ${record.weak} a revisar`,
            String(record.level)]
          : ['—', '—', '—'];
        let x = LEFT + areaWidth + s * sideWidth;
        cells.forEach((cell, c) => {
          fitText(this.add.text(x, y, cell, textStyle(15, record ? COLORS.text : COLORS.muted)), sideWidth * columns[c] - 10);
          x += sideWidth * columns[c];
        });
      });
    });
  }

  /**
   * The lesson titles in a fixed box. When the wrapped lines do not fit, the
   * box shows a window of them that ▲ and ▼ move (no mask: WebGL ignores
   * geometry masks in Phaser 4).
   */
  private drawLessons(text: string) {
    const width = RIGHT - LEFT - 60;
    const list = this.add.text(LEFT, LESSONS_TOP, '', textStyle(14, COLORS.text, { wordWrap: { width }, lineSpacing: 4 }));
    const lines = list.getWrappedText(text || '—');
    const visible = Math.max(1, Math.floor(LESSONS_HEIGHT / 22));
    let first = 0;
    const show = () => list.setText(lines.slice(first, first + visible).join('\n'));
    show();
    if (lines.length <= visible) return;
    const scroll = (delta: number) => {
      first = Phaser.Math.Clamp(first + delta, 0, lines.length - visible);
      show();
    };
    button(this, RIGHT - 44, LESSONS_TOP, 44, 44, '▲', () => scroll(-1), { size: 16 });
    button(this, RIGHT - 44, LESSONS_TOP + LESSONS_HEIGHT - 44, 44, 44, '▼', () => scroll(1), { size: 16 });
  }
}

/**
 * Starts the ceremony of a certificate issued but not presented yet: the
 * formatura for the conclusão one, this screen for a tier. Returns false
 * when there is none.
 */
export function startPendingCeremony(scene: Phaser.Scene): boolean {
  const pending = pendingCertificate(game());
  if (!pending) return false;
  if (pending.id === 'conclusao') scene.scene.start('Formatura');
  else scene.scene.start('Certificate', { id: pending.id } satisfies CertificateData);
  return true;
}

/** What the Hub says after a tier ceremony: the tier that just opened, or the end of the ladder. */
function tierNotice(id: CertificateId): string {
  const index = TIERS.findIndex((t) => t.id === id);
  const next = TIERS[index + 1];
  if (!next) return 'Você concluiu toda a pós-graduação. Parabéns!';
  return `${agree(next.gender, 'O', 'A')} ${next.title} abriu: as aulas sobre ${next.topic} já estão em Estudar.`;
}
