import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

import User from "../models/User.js";

dotenv.config();

const createAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    console.log("MongoDB Connected");

    const adminEmail = "admin@harishchat.com";

    const existingAdmin = await User.findOne({
      email: adminEmail,
    });

    if (existingAdmin) {
      console.log("Admin already exists:");
      console.log(existingAdmin.email);

      await mongoose.disconnect();
      process.exit(0);
    }

    const hashedPassword = await bcrypt.hash(
      "Admin@123",
      10
    );

    const admin = await User.create({
      name: "Administrator",
      email: adminEmail,
      password: hashedPassword,
      role: "ADMIN",
      status: "ACTIVE",
    });

    console.log("----------------------------");
    console.log("Admin created successfully");
    console.log("----------------------------");

    console.log("Name:", admin.name);
    console.log("Email:", admin.email);
    console.log("Role:", admin.role);
    console.log("Status:", admin.status);

    await mongoose.disconnect();

    process.exit(0);
  } catch (error) {
    console.error("Create Admin Error:", error);

    await mongoose.disconnect();

    process.exit(1);
  }
};

createAdmin();