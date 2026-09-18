import { Building2, House, TrendingDown, TrendingUp } from "lucide-react";
import { areaGroup } from "@/lib/area";
import { money, type Data, type Kind } from "@/lib/model";
import {
  latestMonthlyMedianPrice,
  priceScenario,
  scenarioGroups,
  scenarioRates,
} from "@/lib/price-scenarios";
import { regionOptions } from "@/lib/property-context";
import styles from "./price-scenarios.module.css";

type Props = {
  data: Data;
  baseId: string;
  baseKind: Kind;
  regionId: string;
  onBaseChange: (id: string) => void;
  onRegionChange: (id: string) => void;
};

type ScenarioValue = ReturnType<typeof priceScenario>;
type ScenarioTone = "down" | "current" | "up";

const downRates = scenarioRates.filter((rate) => rate < 0);
const upRates = scenarioRates.filter((rate) => rate > 0);
const cellClassNames = {
  down: styles.downCell,
  current: styles.currentCell,
  up: styles.upCell,
} satisfies Record<ScenarioTone, string>;

function gapMoney(value: number) {
  return `${value > 0 ? "+" : ""}${money(value)}`;
}

function ScenarioValueCell({
  value,
  tone,
  emptyLabel,
}: {
  value: ScenarioValue | null;
  tone: ScenarioTone;
  emptyLabel?: string;
}) {
  if (!value) {
    return (
      <td className={cellClassNames[tone]}>
        {emptyLabel ? (
          <>
            <strong>—</strong>
            <span>{emptyLabel}</span>
          </>
        ) : (
          "—"
        )}
      </td>
    );
  }

  return (
    <td className={cellClassNames[tone]}>
      <strong>{gapMoney(value.gap)}</strong>
      <span>관심 {money(value.targetPrice)}</span>
      <span>내 집 {money(value.basePrice)}</span>
    </td>
  );
}

export function PriceScenarios({
  data,
  baseId,
  baseKind,
  regionId,
  onBaseChange,
  onRegionChange,
}: Props) {
  const interestProperties = data.properties.filter((property) => !property.owned);
  const ownedProperties = data.properties.some((property) => property.owned)
    ? data.properties.filter((property) => property.owned)
    : data.properties;
  const baseProperty = data.properties.find((property) => property.id === baseId);
  const baseCurrent = latestMonthlyMedianPrice(data, baseId, baseKind);
  const groups = scenarioGroups(data, baseId, regionId);
  const regionCounts = new Map<string, number>();
  for (const property of interestProperties) {
    regionCounts.set(property.district, (regionCounts.get(property.district) ?? 0) + 1);
  }

  return (
    <section className={styles.page}>
      <div className={styles.toolbar}>
        <div className={styles.filter}>
          <span>지역</span>
          <select
            aria-label="가격 시나리오 지역"
            value={regionId}
            onChange={(event) => onRegionChange(event.target.value)}
          >
            <option value="all">전체 지역 · {interestProperties.length}개 평형</option>
            {regionOptions(interestProperties).map((region) => (
              <option value={region.id} key={region.id}>
                {region.label} · {regionCounts.get(region.id) ?? 0}개 평형
              </option>
            ))}
          </select>
        </div>
        <div className={styles.filter}>
          <span>기준 주택</span>
          <select
            aria-label="가격 시나리오 기준 주택"
            value={baseId}
            onChange={(event) => onBaseChange(event.target.value)}
          >
            {ownedProperties.map((property) => (
              <option value={property.id} key={property.id}>
                {property.name} · {areaGroup(property.area)}㎡
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className={styles.baseCard}>
        <span className={styles.homeIcon}>
          <House size={20} />
        </span>
        <div>
          <small>변동 기준이 되는 내 집 현재 가격</small>
          <strong>
            {baseProperty
              ? `${baseProperty.name} · ${areaGroup(baseProperty.area)}㎡`
              : "기준 주택을 선택하세요"}
          </strong>
        </div>
        <div className={styles.basePrice}>
          {money(baseCurrent?.price)}
          <small>{baseCurrent?.month || "기록 없음"} · 현재 기준</small>
        </div>
        <p>각 열에서 내 집과 관심단지 가격이 동일한 비율로 변동합니다.</p>
      </div>

      <section className={`panel ${styles.panel}`}>
        <div className={styles.panelHeading}>
          <div>
            <h2>동일 비율 가격 변동 시나리오</h2>
            <p>큰 숫자는 격차, 작은 숫자는 변동 후 관심단지와 내 집 가격입니다.</p>
          </div>
          <div className={styles.legend}>
            <span>
              <i className={styles.downDot} />
              가격 하락
            </span>
            <span>
              <i className={styles.currentDot} />
              현재
            </span>
            <span>
              <i className={styles.upDot} />
              가격 상승
            </span>
          </div>
        </div>

        {!baseCurrent ? (
          <div className="empty">
            기준 주택의 현재 가격 기록이 없습니다. 가격 기록을 먼저 추가해 주세요.
          </div>
        ) : !groups.length ? (
          <div className="empty">선택한 지역에 관심단지가 없습니다.</div>
        ) : (
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr className={styles.bandHeader}>
                  <th rowSpan={2} className={styles.propertyHeader}>
                    관심단지
                  </th>
                  <th colSpan={6} className={styles.downBand}>
                    <TrendingDown size={15} />
                    하락했을 때
                  </th>
                  <th rowSpan={2} className={styles.currentHeader}>
                    현재 가격
                  </th>
                  <th colSpan={6} className={styles.upBand}>
                    <TrendingUp size={15} />
                    상승했을 때
                  </th>
                </tr>
                <tr className={styles.rateHeader}>
                  {downRates.map((rate) => (
                    <th key={rate}>{rate}%</th>
                  ))}
                  {upRates.map((rate) => (
                    <th key={rate}>+{rate}%</th>
                  ))}
                </tr>
              </thead>
              {groups.map((group) => (
                <tbody key={group.district}>
                  <tr className={styles.regionRow}>
                    <th className={styles.regionLabel} scope="rowgroup">
                      {group.label}
                      <span>{group.rows.length}개 평형</span>
                    </th>
                    <td className={styles.regionFill} colSpan={13} />
                  </tr>
                  {group.rows.map(({ property, current }) => {
                    const currentValue = current
                      ? priceScenario(baseCurrent.price, current.price, 0)
                      : null;
                    return (
                      <tr key={property.id}>
                        <th className={styles.propertyCell} scope="row">
                          <span className={styles.buildingIcon}>
                            <Building2 size={17} />
                          </span>
                          <span>
                            <strong>{property.name}</strong>
                            <small>
                              전용 {areaGroup(property.area)}㎡ · {current?.month || "기록 없음"}
                            </small>
                          </span>
                        </th>
                        {downRates.map((rate) => (
                          <ScenarioValueCell
                            key={rate}
                            tone="down"
                            value={current && priceScenario(baseCurrent.price, current.price, rate)}
                          />
                        ))}
                        <ScenarioValueCell
                          tone="current"
                          value={currentValue}
                          emptyLabel="가격 기록 없음"
                        />
                        {upRates.map((rate) => (
                          <ScenarioValueCell
                            key={rate}
                            tone="up"
                            value={current && priceScenario(baseCurrent.price, current.price, rate)}
                          />
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              ))}
            </table>
          </div>
        )}
        <div className={styles.footnote}>
          <span>계산 기준</span>
          동일 비율로 변동한 관심단지 가격 − 동일 비율로 변동한 내 집 가격
        </div>
      </section>
    </section>
  );
}
