"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, X, ChevronRight, ChevronLeft } from "lucide-react";
import { CinematicCard } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface NewStaffData {
  name: string;
  email: string;
  phone: string;
  role: string;
  department: string;
  avatar?: string;
}

export interface AddStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: (staffData: NewStaffData) => void;
}

const STEPS = [
  { id: 1, title: "Basic Info", description: "Name and contact details" },
  { id: 2, title: "Role Assignment", description: "Select role and department" },
  { id: 3, title: "Avatar", description: "Upload profile picture" },
];

export const AddStaffModal = React.forwardRef<
  HTMLDivElement,
  AddStaffModalProps
>(({ isOpen, onClose, onSubmit }, ref) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [formData, setFormData] = useState<NewStaffData>({
    name: "",
    email: "",
    phone: "",
    role: "Trainer",
    department: "Training",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setAvatarPreview(result);
        setFormData((prev) => ({
          ...prev,
          avatar: result,
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (step === 1) {
      if (!formData.name.trim()) newErrors.name = "Name is required";
      if (!formData.email.trim()) newErrors.email = "Email is required";
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
        newErrors.email = "Invalid email format";
      if (!formData.phone.trim()) newErrors.phone = "Phone is required";
    }

    if (step === 2) {
      if (!formData.role) newErrors.role = "Role is required";
      if (!formData.department) newErrors.department = "Department is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      if (currentStep < STEPS.length) {
        setCurrentStep(currentStep + 1);
      }
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    if (validateStep(currentStep)) {
      setIsSubmitting(true);
      try {
        await new Promise((resolve) => setTimeout(resolve, 600)); // Simulate API call
        onSubmit?.(formData);
        resetForm();
        onClose();
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      phone: "",
      role: "Trainer",
      department: "Training",
    });
    setAvatarPreview(null);
    setCurrentStep(1);
    setErrors({});
  };

  const progressPercentage = (currentStep / STEPS.length) * 100;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-40"
          />

          {/* Modal */}
          <motion.div
            ref={ref}
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg max-h-[90vh] z-50 overflow-y-auto"
          >
            <CinematicCard
              variant="glow"
              className="w-full rounded-2xl shadow-2xl overflow-hidden"
            >
              {/* Header */}
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.1 }}
                className="relative p-6 border-b border-white/10 bg-gradient-to-r from-purple-600/20 to-pink-600/20"
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-2xl font-bold text-white">
                      Add New Staff
                    </h2>
                    <p className="text-sm text-gray-400 mt-1">
                      {STEPS[currentStep - 1]?.description}
                    </p>
                  </div>
                  <motion.button
                    onClick={onClose}
                    whileHover={{ rotate: 90 }}
                    transition={{ duration: 0.2 }}
                    className="p-2 hover:bg-white/10 rounded-lg"
                  >
                    <X className="w-5 h-5 text-gray-400" />
                  </motion.button>
                </div>

                {/* Progress Bar */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">Step {currentStep} of {STEPS.length}</span>
                    <span className="text-purple-300 font-semibold">
                      {Math.round(progressPercentage)}%
                    </span>
                  </div>
                  <motion.div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                      initial={{ width: "0%" }}
                      animate={{ width: `${progressPercentage}%` }}
                      transition={{ duration: 0.4, ease: "easeOut" }}
                    />
                  </motion.div>
                </div>
              </motion.div>

              {/* Steps Indicator */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: 0.15 }}
                className="flex justify-between px-6 py-4 border-b border-white/10 bg-white/5"
              >
                {STEPS.map((step, index) => (
                  <div key={step.id} className="flex items-center">
                    <motion.div
                      className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold",
                        currentStep >= step.id
                          ? "bg-purple-600 text-white"
                          : "bg-white/10 text-gray-400"
                      )}
                      whileHover={{ scale: 1.1 }}
                    >
                      {step.id}
                    </motion.div>

                    {index < STEPS.length - 1 && (
                      <motion.div
                        className={cn(
                          "w-8 h-1 mx-2",
                          currentStep > step.id
                            ? "bg-purple-600"
                            : "bg-white/10"
                        )}
                      />
                    )}
                  </div>
                ))}
              </motion.div>

              {/* Content */}
              <div className="p-6 space-y-6 min-h-[400px]">
                <AnimatePresence mode="wait">
                  {currentStep === 1 && (
                    <motion.div
                      key="step-1"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.3 }}
                      className="space-y-4"
                    >
                      {/* Name */}
                      <div>
                        <label className="block text-sm font-medium text-white mb-2">
                          Full Name
                        </label>
                        <motion.input
                          type="text"
                          name="name"
                          value={formData.name}
                          onChange={handleInputChange}
                          placeholder="John Doe"
                          className={cn(
                            "w-full px-4 py-3 rounded-lg bg-white/10 border-2",
                            "text-white placeholder:text-gray-500",
                            "focus:outline-none focus:border-purple-500 focus:bg-white/15",
                            "transition-all duration-300",
                            errors.name
                              ? "border-red-500"
                              : "border-white/20"
                          )}
                          whileFocus={{
                            boxShadow:
                              "0 0 20px rgba(168, 85, 247, 0.3)",
                          }}
                        />
                        {errors.name && (
                          <motion.p
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-red-400 text-sm mt-1"
                          >
                            {errors.name}
                          </motion.p>
                        )}
                      </div>

                      {/* Email */}
                      <div>
                        <label className="block text-sm font-medium text-white mb-2">
                          Email Address
                        </label>
                        <motion.input
                          type="email"
                          name="email"
                          value={formData.email}
                          onChange={handleInputChange}
                          placeholder="john@example.com"
                          className={cn(
                            "w-full px-4 py-3 rounded-lg bg-white/10 border-2",
                            "text-white placeholder:text-gray-500",
                            "focus:outline-none focus:border-purple-500 focus:bg-white/15",
                            "transition-all duration-300",
                            errors.email
                              ? "border-red-500"
                              : "border-white/20"
                          )}
                          whileFocus={{
                            boxShadow:
                              "0 0 20px rgba(168, 85, 247, 0.3)",
                          }}
                        />
                        {errors.email && (
                          <motion.p
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-red-400 text-sm mt-1"
                          >
                            {errors.email}
                          </motion.p>
                        )}
                      </div>

                      {/* Phone */}
                      <div>
                        <label className="block text-sm font-medium text-white mb-2">
                          Phone Number
                        </label>
                        <motion.input
                          type="tel"
                          name="phone"
                          value={formData.phone}
                          onChange={handleInputChange}
                          placeholder="+1 (555) 000-0000"
                          className={cn(
                            "w-full px-4 py-3 rounded-lg bg-white/10 border-2",
                            "text-white placeholder:text-gray-500",
                            "focus:outline-none focus:border-purple-500 focus:bg-white/15",
                            "transition-all duration-300",
                            errors.phone
                              ? "border-red-500"
                              : "border-white/20"
                          )}
                          whileFocus={{
                            boxShadow:
                              "0 0 20px rgba(168, 85, 247, 0.3)",
                          }}
                        />
                        {errors.phone && (
                          <motion.p
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-red-400 text-sm mt-1"
                          >
                            {errors.phone}
                          </motion.p>
                        )}
                      </div>
                    </motion.div>
                  )}

                  {currentStep === 2 && (
                    <motion.div
                      key="step-2"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.3 }}
                      className="space-y-4"
                    >
                      {/* Role */}
                      <div>
                        <label className="block text-sm font-medium text-white mb-2">
                          Role
                        </label>
                        <motion.select
                          name="role"
                          value={formData.role}
                          onChange={handleInputChange}
                          className={cn(
                            "w-full px-4 py-3 rounded-lg bg-white/10 border-2",
                            "text-white",
                            "focus:outline-none focus:border-purple-500 focus:bg-white/15",
                            "transition-all duration-300",
                            errors.role ? "border-red-500" : "border-white/20"
                          )}
                          whileFocus={{
                            boxShadow:
                              "0 0 20px rgba(168, 85, 247, 0.3)",
                          }}
                        >
                          <option className="bg-gray-900">Manager</option>
                          <option className="bg-gray-900">Trainer</option>
                          <option className="bg-gray-900">Staff</option>
                          <option className="bg-gray-900">Receptionist</option>
                        </motion.select>
                        {errors.role && (
                          <motion.p
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-red-400 text-sm mt-1"
                          >
                            {errors.role}
                          </motion.p>
                        )}
                      </div>

                      {/* Department */}
                      <div>
                        <label className="block text-sm font-medium text-white mb-2">
                          Department
                        </label>
                        <motion.select
                          name="department"
                          value={formData.department}
                          onChange={handleInputChange}
                          className={cn(
                            "w-full px-4 py-3 rounded-lg bg-white/10 border-2",
                            "text-white",
                            "focus:outline-none focus:border-purple-500 focus:bg-white/15",
                            "transition-all duration-300",
                            errors.department
                              ? "border-red-500"
                              : "border-white/20"
                          )}
                          whileFocus={{
                            boxShadow:
                              "0 0 20px rgba(168, 85, 247, 0.3)",
                          }}
                        >
                          <option className="bg-gray-900">Training</option>
                          <option className="bg-gray-900">Reception</option>
                          <option className="bg-gray-900">Management</option>
                          <option className="bg-gray-900">Maintenance</option>
                        </motion.select>
                        {errors.department && (
                          <motion.p
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-red-400 text-sm mt-1"
                          >
                            {errors.department}
                          </motion.p>
                        )}
                      </div>

                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg"
                      >
                        <p className="text-sm text-purple-300">
                          <strong>Selected Role:</strong> {formData.role}
                        </p>
                        <p className="text-sm text-purple-300">
                          <strong>Department:</strong> {formData.department}
                        </p>
                      </motion.div>
                    </motion.div>
                  )}

                  {currentStep === 3 && (
                    <motion.div
                      key="step-3"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.3 }}
                      className="space-y-4"
                    >
                      <label className="block text-sm font-medium text-white mb-4">
                        Profile Picture (Optional)
                      </label>

                      {avatarPreview ? (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="relative mx-auto w-32 h-32"
                        >
                          <img
                            src={avatarPreview}
                            alt="Avatar preview"
                            className="w-full h-full rounded-lg object-cover border-2 border-purple-500"
                          />
                          <motion.button
                            onClick={() => {
                              setAvatarPreview(null);
                              setFormData((prev) => ({
                                ...prev,
                                avatar: undefined,
                              }));
                            }}
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            className="absolute -top-2 -right-2 p-2 bg-red-500 rounded-full text-white"
                          >
                            <X className="w-4 h-4" />
                          </motion.button>
                        </motion.div>
                      ) : (
                        <motion.label
                          whileHover={{ scale: 1.02 }}
                          className="border-2 border-dashed border-white/20 rounded-lg p-8 cursor-pointer hover:border-purple-500 transition-colors flex flex-col items-center justify-center gap-3"
                        >
                          <Upload className="w-8 h-8 text-gray-400" />
                          <div>
                            <p className="text-white font-medium">
                              Click to upload
                            </p>
                            <p className="text-xs text-gray-400">
                              PNG, JPG, GIF up to 5MB
                            </p>
                          </div>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleAvatarUpload}
                            className="hidden"
                          />
                        </motion.label>
                      )}

                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg"
                      >
                        <p className="text-sm text-blue-300">
                          Summary:
                        </p>
                        <p className="text-sm text-blue-300 mt-2">
                          <strong>Name:</strong> {formData.name}
                        </p>
                        <p className="text-sm text-blue-300">
                          <strong>Email:</strong> {formData.email}
                        </p>
                        <p className="text-sm text-blue-300">
                          <strong>Role:</strong> {formData.role} ({formData.department})
                        </p>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Footer */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: 0.2 }}
                className="flex gap-3 p-6 border-t border-white/10 bg-white/5"
              >
                <motion.button
                  onClick={handlePrevious}
                  disabled={currentStep === 1}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg font-medium",
                    currentStep === 1
                      ? "bg-white/10 text-gray-400 cursor-not-allowed"
                      : "bg-white/10 text-white hover:bg-white/20"
                  )}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </motion.button>

                {currentStep < STEPS.length ? (
                  <motion.button
                    onClick={handleNext}
                    disabled={isSubmitting}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 transition-all"
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </motion.button>
                ) : (
                  <motion.button
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    animate={
                      isSubmitting
                        ? { scale: [1, 1.02, 1] }
                        : {}
                    }
                    transition={{ duration: 0.5, repeat: Infinity }}
                    className={cn(
                      "flex-1 px-4 py-2 rounded-lg font-medium",
                      "bg-gradient-to-r from-green-600 to-emerald-600 text-white",
                      "hover:from-green-700 hover:to-emerald-700 transition-all",
                      isSubmitting && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    {isSubmitting ? (
                      <motion.span
                        animate={{ rotate: 360 }}
                        transition={{
                          duration: 1,
                          repeat: Infinity,
                        }}
                        className="inline-block"
                      >
                        ⏳
                      </motion.span>
                    ) : (
                      "Create Staff"
                    )}
                  </motion.button>
                )}
              </motion.div>
            </CinematicCard>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
});

AddStaffModal.displayName = "AddStaffModal";
