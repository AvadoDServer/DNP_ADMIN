import React from "react";
import { toast } from "react-toastify";
import { NavLink } from "react-router-dom";
import Button from "components/ui/Button";
import "./toastStyle.css";

const errorElement = message => (
  <div className="flex flex-col items-start gap-2">
    {message}
    <Button as={NavLink} to="/system/history" variant="secondary" size="sm">
      Show details
    </Button>
  </div>
);

const pendingElement = message => (
  <div>
    <div style={{ minHeight: "35px" }}>{message}</div>
    <div className="slider">
      <div className="line" />
      <div className="subline inc" />
      <div className="subline dec" />
    </div>
    <div className="slider-fade" />
  </div>
);

export default function Toast({ message, pending = false, success }) {
  const { SUCCESS, ERROR } = toast.TYPE;
  const position = toast.POSITION.BOTTOM_RIGHT;
  const autoClose = 5000;
  let id;

  if (pending) {
    id = toast(pendingElement(message), {
      position,
      autoClose: false
    });
  } else if (success) {
    toast(message, {
      position,
      autoClose,
      type: SUCCESS
    });
  } else {
    toast(errorElement(message), {
      position,
      autoClose,
      type: ERROR
    });
  }

  return {
    id,
    resolve: res => {
      // Prevent racing condition if the toast is resolved too fast
      const defaultMsg = "Broken response, missing res message";
      setTimeout(() => {
        if (!id) return;
        if (toast.isActive(id))
          if (res.success) {
            // Existing toast, update
            toast.update(id, {
              render: res.message || defaultMsg,
              autoClose,
              type: SUCCESS
            });
          } else {
            toast.update(id, {
              render: errorElement(res.message || defaultMsg),
              autoClose,
              type: ERROR
            });
          }
        else if (res.success)
          toast(res.message || defaultMsg, {
            position,
            autoClose,
            type: SUCCESS
          });
        else {
          toast.error(errorElement(res.message || defaultMsg), {
            position,
            autoClose,
            type: ERROR
          });
        }
      }, 10);
    }
  };
}
