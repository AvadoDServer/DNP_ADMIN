import React from "react";
import { title } from "../data";
// Components
import PackageList from "./PackageList";
import { PageHeader } from "./PackagePresentation";

const PackagesHome = () => (
  <div className="animate-fade-in">
    <PageHeader
      title="My DApps"
      subtitle="Manage, restart and configure your installed AVADO applications."
    />
    <PackageList moduleName={title} coreDnps={false} />
  </div>
);

export default PackagesHome;
