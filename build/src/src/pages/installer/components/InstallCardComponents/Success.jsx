import React from "react";
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import { rootPath as packagesRootPath } from "pages/packages";
// UI kit
import Card from "components/ui/Card";
import Button from "components/ui/Button";

export default class Success extends React.Component {
  static propTypes = {
    manifest: PropTypes.object.isRequired,
  };

  render() {
    const id = (this.props.manifest || {}).name;

    return (
      <Card padding="lg" className="flex flex-col items-start gap-3">
        <div className="flex items-center gap-2 text-success-text">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 6 9 17l-5-5" />
          </svg>
          <span className="text-base font-semibold">Installed successfully</span>
        </div>
        <Link to={packagesRootPath + "/" + id}>
          <Button variant="primary">Go to package</Button>
        </Link>
      </Card>
    );
  }
}
