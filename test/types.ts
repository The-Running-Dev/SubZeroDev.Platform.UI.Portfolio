import type {
  LinkCapabilityV1,
  PortfolioProps,
  PortfolioViewModelV1,
  ValidationResult,
} from "subzerodev-platform-ui-portfolio";

declare const link: LinkCapabilityV1;
declare const model: PortfolioViewModelV1;
declare const props: PortfolioProps;
declare const result: ValidationResult<PortfolioViewModelV1>;

const href: string | undefined = link.href;
const title: string = model.header.title;
const portfolioModel: PortfolioViewModelV1 = props.model;

if (result.ok === true) {
  const validated: PortfolioViewModelV1 = result.value;
  void validated;
} else {
  const code: string = result.issues[0]?.code ?? "";
  void code;
}

void href;
void title;
void portfolioModel;
