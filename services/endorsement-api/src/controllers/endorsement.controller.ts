import type { Request, ResponseToolkit } from '@hapi/hapi';
import type { EndorsementRequestDto } from '../entities/endorsement.dto';
import type { TranslationService } from '../services/translation.service';

export class EndorsementController {
  constructor(private readonly translation: TranslationService) {}

  translate = async (request: Request, h: ResponseToolkit) => {
    const { document, template } = await this.translation.translate(
      request.payload as EndorsementRequestDto,
    );

    // El cuerpo es exactamente el JSON del core; la trazabilidad viaja en cabeceras.
    return h
      .response(document as object)
      .header('x-template-id', String(template.id))
      .header('x-template-version', String(template.version));
  };

  listTemplates = async () => {
    return { templates: await this.translation.listTemplates() };
  };
}
