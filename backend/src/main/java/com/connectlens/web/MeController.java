package com.connectlens.web;

import com.connectlens.model.MeDto;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api")
public class MeController {

    @GetMapping("/me")
    public MeDto me() {
        // Read from the security context (not a controller param): a servlet Principal param is
        // null for anonymous auth, which is exactly the no-auth ("local" ADMIN) case.
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getName() == null) {
            return new MeDto("local", List.of("ADMIN"));
        }
        List<String> roles = auth.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .filter(a -> a.startsWith("ROLE_"))
                .map(a -> a.substring("ROLE_".length()))
                .toList();
        return new MeDto(auth.getName(), roles);
    }
}
