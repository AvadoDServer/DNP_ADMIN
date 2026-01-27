import React, { useState } from "react";
import "./priority.css";
// Components
import Title from "components/Title";
import SubTitle from "components/SubTitle";
import Card from "components/Card";
import Button from "components/Button";

/**
 * Priority Support Page
 * Displays subscription status and allows activation of subscription codes
 */

function Priority() {
  // Mock state - in production this would come from backend API
  const [hasSubscription, setHasSubscription] = useState(false);
  const [subscriptionCode, setSubscriptionCode] = useState("");
  const [subscriptionEndDate, setSubscriptionEndDate] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const handleActivateSubscription = async () => {
    if (!subscriptionCode.trim()) {
      setErrorMessage("Please enter a subscription code");
      return;
    }

    setIsLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    // TODO: Replace with actual API call to backend
    // Simulating API call
    setTimeout(() => {
      // Mock validation - replace with actual API call
      if (subscriptionCode === "DEMO-CODE-123") {
        const endDate = new Date();
        endDate.setFullYear(endDate.getFullYear() + 1);
        setHasSubscription(true);
        setSubscriptionEndDate(endDate);
        setSuccessMessage("Subscription activated successfully!");
        setSubscriptionCode("");
      } else {
        setErrorMessage("Invalid subscription code. Please check and try again.");
      }
      setIsLoading(false);
    }, 1000);
  };

  const formatDate = (date) => {
    if (!date) return "";
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  };

  return (
    <div className="priority-container">
      <Title>Priority Support</Title>
      
      {hasSubscription ? (
        <Card className="priority-card">
          <div className="subscription-active">
            <div className="status-icon">✓</div>
            <SubTitle>Active Subscription</SubTitle>
            <p className="subscription-info">
              Your priority support subscription is active.
            </p>
            <div className="subscription-details">
              <p><strong>Status:</strong> Active</p>
              <p><strong>Expires:</strong> {formatDate(subscriptionEndDate)}</p>
            </div>
            <div className="benefits-section">
              <h3>Your Benefits Include:</h3>
              <ul className="benefits-list">
                <li>Priority email support with 24-hour response time</li>
                <li>Access to private support channels</li>
                <li>Personal support sessions</li>
                <li>Advanced troubleshooting assistance</li>
                <li>Configuration optimization support</li>
              </ul>
            </div>
            <p className="support-contact">
              Need help? Contact our priority support team at{" "}
              <a href="mailto:priority@avado.cloud">priority@avado.cloud</a>
            </p>
          </div>
        </Card>
      ) : (
        <Card className="priority-card">
          <div className="subscription-inactive">
            <SubTitle>Get Priority Support</SubTitle>
            <p className="intro-text">
              Upgrade your AVADO experience with our Priority Support subscription.
            </p>
            
            <div className="benefits-section">
              <h3>What's Included:</h3>
              <ul className="benefits-list">
                <li>Priority email support with 24-hour response time</li>
                <li>Access to private support channels</li>
                <li>Personal 1-on-1 support sessions</li>
                <li>Advanced troubleshooting assistance</li>
                <li>Configuration optimization support</li>
                <li>Expert guidance for complex setups</li>
              </ul>
            </div>

            <div className="pricing-section">
              <h3>Pricing:</h3>
              <div className="pricing-options">
                <div className="price-option">
                  <div className="price-amount">€12/month</div>
                  <div className="price-description">Monthly subscription</div>
                </div>
                <div className="price-option highlighted">
                  <div className="price-badge">Best Value</div>
                  <div className="price-amount">€100/year</div>
                  <div className="price-description">Annual subscription (Save €44!)</div>
                </div>
              </div>
            </div>

            <div className="purchase-section">
              <h3>How to Purchase:</h3>
              <p>
                Visit our shop to purchase a Priority Support subscription:
              </p>
              <a 
                href="https://ava.do/shop" 
                target="_blank" 
                rel="noopener noreferrer"
                className="shop-link"
              >
                <Button>Visit AVADO Shop</Button>
              </a>
            </div>

            <div className="activation-section">
              <h3>Already Purchased? Activate Your Subscription:</h3>
              <p>Enter your subscription code below to activate your priority support.</p>
              
              {errorMessage && (
                <div className="error-message">{errorMessage}</div>
              )}
              
              {successMessage && (
                <div className="success-message">{successMessage}</div>
              )}
              
              <div className="activation-form">
                <input
                  type="text"
                  className="subscription-input"
                  placeholder="Enter your subscription code"
                  value={subscriptionCode}
                  onChange={(e) => setSubscriptionCode(e.target.value.toUpperCase())}
                  disabled={isLoading}
                />
                <Button 
                  onClick={handleActivateSubscription}
                  disabled={isLoading}
                >
                  {isLoading ? "Activating..." : "Activate"}
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

export default Priority;
