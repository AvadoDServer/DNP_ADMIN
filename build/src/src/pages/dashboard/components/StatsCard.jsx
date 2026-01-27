import Card from "components/Card";
import PropTypes from "prop-types";
import ProgressBar from "react-bootstrap/ProgressBar";

function parseVariant(value) {
  if (value > 90) return "danger";
  if (value > 75) return "warning";
  return "success";
}

function StatsCard({ id, percent, used, total, subtitle }) {
  const value = parseInt(percent) || 0;
  return (
    <Card className="stats-card">
      <div className="header">
        <div className="label">
          <span className="id">{id}</span>
          <span className="usage">usage</span>
        </div>
        <span className="percent">{value}%</span>
      </div>
      <ProgressBar variant={parseVariant(value)} now={value} />
      {(used && total) ? (
        <div className="details">
          {used} / {total}
        </div>
      ) : subtitle ? (
        <div className="details">
          {subtitle}
        </div>
      ) : null}
    </Card>
  );
}

StatsCard.propTypes = {
  id: PropTypes.string.isRequired,
  percent: PropTypes.string,
  used: PropTypes.string,
  total: PropTypes.string,
  subtitle: PropTypes.string
};

export default StatsCard;
