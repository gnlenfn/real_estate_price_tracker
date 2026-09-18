import {
  Building2,
  House,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { areaGroup } from "@/lib/area";
import { money, type Data, type Kind } from "@/lib/model";
import {
  latestMonthlyMedianPrice,
  priceScenario,
  scenarioRates,
} from "@/lib/price-scenarios";
import {
  propertyRegionLabel,
  regionOptions,
} from "@/lib/property-context";

type Props = {
  data: Data;
  baseId: string;
  baseKind: Kind;
  regionId: string;
  onBaseChange: (id: string) => void;
  onRegionChange: (id: string) => void;
};

function gapMoney(value: number) {
  return `${value > 0 ? "+" : ""}${money(value)}`;
}

export function PriceScenarios({
  data,
  baseId,
  baseKind,
  regionId,
  onBaseChange,
  onRegionChange,
}: Props) {
  const ownedProperties = data.properties.some((property) => property.owned)
    ? data.properties.filter((property) => property.owned)
    : data.properties;
  const baseProperty = data.properties.find((property) => property.id === baseId);
  const baseCurrent = latestMonthlyMedianPrice(data, baseId, baseKind);
  const watchProperties = data.properties
    .filter(
      (property) =>
        !property.owned &&
        property.id !== baseId &&
        (regionId === "all" || property.district === regionId),
    )
    .toSorted(
      (left, right) =>
        propertyRegionLabel(left).localeCompare(propertyRegionLabel(right), "ko") ||
        left.name.localeCompare(right.name, "ko") ||
        areaGroup(left.area) - areaGroup(right.area),
    );
  const groupedByRegion = new Map<string, typeof watchProperties>();
  for (const property of watchProperties) {
    groupedByRegion.set(property.district, [
      ...(groupedByRegion.get(property.district) ?? []),
      property,
    ]);
  }
  const downRates = scenarioRates.filter((rate) => rate < 0);
  const upRates = scenarioRates.filter((rate) => rate > 0);

  return (
    <section className="scenario-page">
      <div className="scenario-toolbar">
        <div className="scenario-filter">
          <span>지역</span>
          <select
            aria-label="가격 시나리오 지역"
            value={regionId}
            onChange={(event) => onRegionChange(event.target.value)}
          >
            <option value="all">
              전체 지역 · {data.properties.filter((property) => !property.owned).length}개 평형
            </option>
            {regionOptions(data.properties.filter((property) => !property.owned)).map(
              (region) => (
                <option value={region.id} key={region.id}>
                  {region.label} ·{" "}
                  {
                    data.properties.filter(
                      (property) =>
                        !property.owned && property.district === region.id,
                    ).length
                  }
                  개 평형
                </option>
              ),
            )}
          </select>
        </div>
        <div className="scenario-filter">
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

      <div className="scenario-base-card">
        <span className="scenario-home-icon"><House size={20} /></span>
        <div>
          <small>변동 기준이 되는 내 집 현재 가격</small>
          <strong>
            {baseProperty
              ? `${baseProperty.name} · ${areaGroup(baseProperty.area)}㎡`
              : "기준 주택을 선택하세요"}
          </strong>
        </div>
        <div className="scenario-base-price">
          {money(baseCurrent?.price)}
          <small>{baseCurrent?.month || "기록 없음"} · 현재 기준</small>
        </div>
        <p>각 열에서 내 집과 관심단지 가격이 동일한 비율로 변동합니다.</p>
      </div>

      <section className="panel scenario-panel">
        <div className="scenario-panel-heading">
          <div>
            <h2>동일 비율 가격 변동 시나리오</h2>
            <p>큰 숫자는 격차, 작은 숫자는 변동 후 관심단지와 내 집 가격입니다.</p>
          </div>
          <div className="scenario-legend">
            <span><i className="scenario-down-dot" />가격 하락</span>
            <span><i className="scenario-current-dot" />현재</span>
            <span><i className="scenario-up-dot" />가격 상승</span>
          </div>
        </div>

        {!baseCurrent ? (
          <div className="empty">
            기준 주택의 현재 가격 기록이 없습니다. 가격 기록을 먼저 추가해 주세요.
          </div>
        ) : !watchProperties.length ? (
          <div className="empty">선택한 지역에 관심단지가 없습니다.</div>
        ) : (
          <div className="scenario-table-wrap">
            <table>
              <thead>
                <tr className="scenario-band-header">
                  <th rowSpan={2} className="scenario-property-header">관심단지</th>
                  <th colSpan={6} className="scenario-down-band">
                    <TrendingDown size={15} />하락했을 때
                  </th>
                  <th rowSpan={2} className="scenario-current-header">현재 가격</th>
                  <th colSpan={6} className="scenario-up-band">
                    <TrendingUp size={15} />상승했을 때
                  </th>
                </tr>
                <tr className="scenario-rate-header">
                  {downRates.map((rate) => <th key={rate}>{rate}%</th>)}
                  {upRates.map((rate) => <th key={rate}>+{rate}%</th>)}
                </tr>
              </thead>
              {[...groupedByRegion].map(([district, properties]) => (
                <tbody key={district}>
                  <tr className="scenario-region-row">
                    <th className="scenario-region-label" scope="rowgroup">
                      {propertyRegionLabel(properties[0])}
                      <span>{properties.length}개 평형</span>
                    </th>
                    <td className="scenario-region-fill" colSpan={13} />
                  </tr>
                  {properties.map((property) => {
                    const targetCurrent = latestMonthlyMedianPrice(
                      data,
                      property.id,
                      "trade",
                    );
                    return (
                      <tr key={property.id}>
                        <th className="scenario-property-cell" scope="row">
                          <span className="scenario-building-icon">
                            <Building2 size={17} />
                          </span>
                          <span>
                            <strong>{property.name}</strong>
                            <small>
                              전용 {areaGroup(property.area)}㎡ ·{" "}
                              {targetCurrent?.month || "기록 없음"}
                            </small>
                          </span>
                        </th>
                        {downRates.map((rate) => {
                          if (!targetCurrent)
                            return <td className="scenario-down-cell" key={rate}>—</td>;
                          const result = priceScenario(
                            baseCurrent.price,
                            targetCurrent.price,
                            rate,
                          );
                          return (
                            <td className="scenario-down-cell" key={rate}>
                              <strong>{gapMoney(result.gap)}</strong>
                              <span>관심 {money(result.targetPrice)}</span>
                              <span>내 집 {money(result.basePrice)}</span>
                            </td>
                          );
                        })}
                        <td className="scenario-current-cell">
                          {targetCurrent ? (
                            <>
                              <strong>
                                {gapMoney(targetCurrent.price - baseCurrent.price)}
                              </strong>
                              <span>관심 {money(targetCurrent.price)}</span>
                              <span>내 집 {money(baseCurrent.price)}</span>
                            </>
                          ) : (
                            <><strong>—</strong><span>가격 기록 없음</span></>
                          )}
                        </td>
                        {upRates.map((rate) => {
                          if (!targetCurrent)
                            return <td className="scenario-up-cell" key={rate}>—</td>;
                          const result = priceScenario(
                            baseCurrent.price,
                            targetCurrent.price,
                            rate,
                          );
                          return (
                            <td className="scenario-up-cell" key={rate}>
                              <strong>{gapMoney(result.gap)}</strong>
                              <span>관심 {money(result.targetPrice)}</span>
                              <span>내 집 {money(result.basePrice)}</span>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              ))}
            </table>
          </div>
        )}
        <div className="scenario-footnote">
          <span>계산 기준</span>
          동일 비율로 변동한 관심단지 가격 − 동일 비율로 변동한 내 집 가격
        </div>
      </section>
    </section>
  );
}
