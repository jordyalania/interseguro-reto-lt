import type {
  EndorsementRequestDto,
  TemplateSummaryDto,
  TranslationResultDto,
} from '../entities/endorsement.dto';
import { appError, ErrorCode, TemplateConfigurationError } from '../errors/app-error';
import { buildCoreEndorsement, describeTemplateInputs } from '../mappers/core-endorsement.mapper';
import { toTemplateDefinition } from '../mappers/template.mapper';
import type { TemplateRepository } from '../repositories/template.repository';
import { validateInputValues } from './input-validator';

export class TranslationService {
  constructor(private readonly templates: TemplateRepository) {}

  async translate(request: EndorsementRequestDto): Promise<TranslationResultDto> {
    const { producto, tipoEndoso } = request;

    const model = await this.templates.findActive(producto, tipoEndoso);
    if (!model) {
      throw appError(
        404,
        ErrorCode.TemplateNotFound,
        `No existe una plantilla activa para ${producto} / ${tipoEndoso}`,
      );
    }

    const template = toTemplateDefinition(model);
    const { document, missing } = this.build(template, request);
    const invalid = validateInputValues(template.inputRules, request);

    if (invalid.length > 0) {
      throw appError(
        422,
        ErrorCode.InvalidFieldValues,
        'Hay campos con valores inválidos para la plantilla configurada',
        { invalid, missing },
      );
    }

    if (missing.length > 0) {
      throw appError(
        422,
        ErrorCode.MissingRequiredFields,
        'Faltan campos obligatorios para la plantilla configurada',
        { missing },
      );
    }

    return {
      document,
      template: {
        id: template.id,
        productCode: template.productCode,
        endorsementTypeCode: template.endorsementTypeCode,
        version: template.version,
      },
    };
  }

  async listTemplates(): Promise<TemplateSummaryDto[]> {
    const models = await this.templates.listActive();
    return models.map((model) => {
      const template = toTemplateDefinition(model);
      return {
        productCode: template.productCode,
        endorsementTypeCode: template.endorsementTypeCode,
        version: template.version,
        inputs: describeTemplateInputs(template),
      };
    });
  }

  private build(
    template: ReturnType<typeof toTemplateDefinition>,
    request: EndorsementRequestDto,
  ): ReturnType<typeof buildCoreEndorsement> {
    try {
      return buildCoreEndorsement(template, request);
    } catch (error) {
      if (error instanceof TemplateConfigurationError) {
        throw appError(
          500,
          ErrorCode.TemplateMisconfigured,
          `La plantilla ${template.productCode} / ${template.endorsementTypeCode} v${template.version} está mal configurada`,
        );
      }
      throw error;
    }
  }
}
