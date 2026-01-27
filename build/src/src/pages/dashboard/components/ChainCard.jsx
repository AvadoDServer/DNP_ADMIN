import Card from "components/Card";
import PropTypes from "prop-types";
import ProgressBar from "react-bootstrap/ProgressBar";

function ChainCard({ name, message, progress, error, syncing }) {
  // Handle invalid progress values - default to 0 if NaN, undefined, or null
  const progressValue = typeof progress === 'number' && !isNaN(progress) ? progress : 0;
  const progressPercent = Math.floor(100 * progressValue);
  
  return (
    <Card className="chain-card">
      <div className="name">{name === "Mainnet" ? "Ethereum" : name}</div>

      {syncing ? (
        <ProgressBar
          now={progressPercent}
          animated={true}
          label={progressPercent > 0 ? `${progressPercent}%` : ''}
        />
      ) : error ? (
        <ProgressBar now={100} variant="danger" />
      ) : (
        <ProgressBar now={100} variant="success" />
      )}

      <div className="message">{message}</div>
    </Card>
  );
}

ChainCard.propTypes = {
  name: PropTypes.string.isRequired,
  message: PropTypes.string.isRequired,
  // syncing: PropTypes.bool.isRequired,
  progress: PropTypes.number
};

export default ChainCard;
