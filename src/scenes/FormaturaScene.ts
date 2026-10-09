import Phaser from 'phaser';
import { pendingCertificate, presentCertificate, validateStudentName } from '../core/certificates';
import { agree } from '../core/fmt';
import { game, save } from '../core/store';
import { TIERS } from '../data/tiers';
import { button, COLORS, fitText, header, Layer, textInput, textStyle, WIDTH } from '../ui/widgets';
import type { CertificateData } from './CertificateScene';

export interface FormaturaData {
  /** After the certificate: the closing screen that offers the pós-graduação. */
  step?: 'epilogue';
}

/**
 * The end of the campaign: the student types the name for their certificates,
 * confirms it and receives the Certificado de conclusão. Only after that does
 * the closing screen offer the pós-graduação, as an optional new chapter.
 */
export class FormaturaScene extends Phaser.Scene {
  private layer!: Layer;
  private nameField: { value(): string; destroy(): void } | null = null;

  constructor() {
    super('Formatura');
  }

  create(data: FormaturaData = {}) {
    this.cameras.main.setBackgroundColor(COLORS.bg);
    header(this, 'Formatura');
    this.layer = new Layer(this);
    this.nameField = null;
    if (data.step === 'epilogue') this.showEpilogue();
    else if (pendingCertificate(game())?.id === 'conclusao') this.showIntro();
    else this.scene.start('Hub');
  }

  private clear() {
    this.nameField?.destroy();
    this.nameField = null;
    this.layer.clear();
  }

  private showIntro() {
    this.clear();
    this.layer.text(WIDTH / 2, 130, 'CURSO CONCLUÍDO', textStyle(44, COLORS.accent)).setOrigin(0.5);
    fitText(this.layer.text(WIDTH / 2, 200, [
      'Você completou o exercício final do laboratório de segurança.',
      '',
      'Começou com um gabinete vazio, montou o PC, colocou a máquina na rede e aprendeu binário, endereços IP, DNS, portas e web.',
      'Depois passou por todas as máquinas do laboratório, sempre dentro do escopo e com ética.',
      '',
      'Essa era a última etapa do curso. Agora só falta receber o seu certificado.',
    ].join('\n'), textStyle(20, COLORS.text, { align: 'center', lineSpacing: 8, wordWrap: { width: WIDTH - 240 } })).setOrigin(0.5, 0), WIDTH - 240, 300);
    this.layer.button(WIDTH / 2 - 180, 540, 360, 60, 'Receber o certificado', () => this.showName(), { size: 22, color: COLORS.warn });
  }

  /** The name field; "Corrigir" comes back here with the typed name kept. */
  private showName(kept = '', error?: string) {
    this.clear();
    fitText(this.layer.text(WIDTH / 2, 150, 'Como o seu nome deve aparecer no certificado?', textStyle(26, COLORS.accent)).setOrigin(0.5), WIDTH - 160);
    this.layer.text(WIDTH / 2, 200, 'Ele vai sair em todos os certificados que você receber.', textStyle(17, COLORS.muted)).setOrigin(0.5);
    const submit = () => {
      const typed = this.nameField?.value() ?? '';
      const check = validateStudentName(typed);
      if (check.ok) this.showConfirm(check.name);
      else this.showName(typed, check.message);
    };
    this.nameField = textInput(this, WIDTH / 2 - 320, 250, 640, 64, { value: kept, maxLength: 30, onEnter: submit });
    if (error) this.layer.text(WIDTH / 2, 340, `✗ ${error}`, textStyle(18, COLORS.danger)).setOrigin(0.5);
    this.layer.button(WIDTH / 2 - 150, 400, 300, 56, 'Continuar', submit, { size: 22 });
  }

  private showConfirm(name: string) {
    this.clear();
    this.layer.text(WIDTH / 2, 150, 'Assim o seu nome vai sair no certificado:', textStyle(22, COLORS.info)).setOrigin(0.5);
    this.layer.rect(WIDTH / 2 - 360, 200, 720, 96, COLORS.panel, COLORS.warn);
    fitText(this.layer.text(WIDTH / 2, 248, name, textStyle(40, COLORS.warn)).setOrigin(0.5), 680);
    this.layer.text(WIDTH / 2, 336, 'Confira com calma: depois de confirmar, o nome não muda mais.', textStyle(17, COLORS.muted)).setOrigin(0.5);
    this.layer.button(WIDTH / 2 - 320, 400, 300, 56, 'Corrigir', () => this.showName(name), { size: 22, color: COLORS.info });
    this.layer.button(WIDTH / 2 + 20, 400, 300, 56, 'Confirmar', () => {
      presentCertificate(game(), 'conclusao', name);
      save();
      const data: CertificateData = { id: 'conclusao', after: 'epilogue' };
      this.scene.start('Certificate', data);
    }, { size: 22, color: COLORS.warn });
  }

  /** The course is complete; the pós-graduação is offered as optional, naming only its first step. */
  private showEpilogue() {
    this.clear();
    const first = TIERS[0];
    const name = game().studentName ?? '';
    this.layer.text(WIDTH / 2, 130, `Parabéns, ${name}!`, textStyle(40, COLORS.accent)).setOrigin(0.5);
    fitText(this.layer.text(WIDTH / 2, 200, [
      'O seu certificado de conclusão está guardado, e dá para abrir de novo na sua estação quando quiser.',
      '',
      'Se tiver vontade de aprender mais, existe um capítulo novo e opcional: a pós-graduação.',
      `Ela começa ${agree(first.gender, 'pelo', 'pela')} ${first.title}, com aulas sobre ${first.topic}, que já estão esperando por você em Estudar.`,
      '',
      'Nada disso é obrigatório: o curso já está completo.',
    ].join('\n'), textStyle(20, COLORS.text, { align: 'center', lineSpacing: 8, wordWrap: { width: WIDTH - 240 } })).setOrigin(0.5, 0), WIDTH - 240, 300);
    button(this, WIDTH / 2 - 180, 540, 360, 60, 'Voltar à estação', () => this.scene.start('Hub'), { size: 22 });
  }
}
