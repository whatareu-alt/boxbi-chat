package com.example.chatengine.serverspring;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class ServerSpringApplication {

	public static void main(String[] args) {
		SpringApplication.run(ServerSpringApplication.class, args);
	}

}
