import type {
  LinkCapabilityV1,
  PortfolioProps,
  PortfolioViewModelV1,
  SourceProviderCapability,
  ValidationResult,
} from "subzerodev-platform-ui-portfolio";
import type { DataJsonSourceOptions } from "subzerodev-platform-ui-portfolio/data-json";
import type { JsonLoader } from "subzerodev-data-json";

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

declare const loader: JsonLoader;
declare const dataJsonOptions: DataJsonSourceOptions;
const boundLoader: JsonLoader = dataJsonOptions.loader;
void loader;
void boundLoader;
const capability: SourceProviderCapability = { kind: "data-json", publicDescriptor: [], resolve: async () => ({ value: null, metadata: [] }) };
void capability;

void href;
void title;
void portfolioModel;
